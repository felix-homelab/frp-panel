package dao

import (
	"context"
	"path/filepath"
	"sort"
	"testing"

	"github.com/VaalaCat/frp-panel/defs"
	"github.com/VaalaCat/frp-panel/models"
	"github.com/VaalaCat/frp-panel/services/app"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

const (
	testOriginClientID = "c1"
	testChildClientID  = "c1@1" // app.ShadowedClientID(testOriginClientID, 1)
	testServerID       = "s1"
)

var testUser = &models.UserEntity{UserID: 7, TenantID: 3, UserName: "alice"}

// newTestDB is a file-backed sqlite DB rather than ":memory:": every pooled connection
// to ":memory:" opens its own empty database.
func newTestDB(t *testing.T) (*app.Context, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	mgr := models.NewDBManager(defs.DBTypeSQLite3)
	mgr.SetDB(defs.DBTypeSQLite3, defs.DBRoleDefault, db)
	mgr.Init()

	a := app.NewApp()
	a.SetDBManager(mgr)
	return app.NewContext(context.Background(), a), db
}

func childClient(proxiesJSON string) *models.Client {
	return &models.Client{ClientEntity: &models.ClientEntity{
		ClientID:       testChildClientID,
		OriginClientID: testOriginClientID,
		ServerID:       testServerID,
		UserID:         testUser.UserID,
		TenantID:       testUser.TenantID,
		ConfigContent:  []byte(`{"proxies":` + proxiesJSON + `}`),
	}}
}

func insertProxyRow(t *testing.T, db *gorm.DB, name string, stopped bool) *models.ProxyConfig {
	t.Helper()
	row := &models.ProxyConfig{ProxyConfigEntity: &models.ProxyConfigEntity{
		ServerID:       testServerID,
		ClientID:       testChildClientID,
		OriginClientID: testOriginClientID,
		UserID:         testUser.UserID,
		TenantID:       testUser.TenantID,
		Name:           name,
		Type:           "tcp",
		Content:        []byte(`{"name":"` + name + `","type":"tcp","remotePort":6000}`),
		Stopped:        stopped,
	}}
	if err := db.Create(row).Error; err != nil {
		t.Fatalf("insert %s: %v", name, err)
	}
	return row
}

type rowSummary struct {
	ID      uint
	Name    string
	Stopped bool
}

func proxyRows(t *testing.T, db *gorm.DB) []rowSummary {
	t.Helper()
	var rows []*models.ProxyConfig
	if err := db.Order("id").Find(&rows).Error; err != nil {
		t.Fatalf("list rows: %v", err)
	}
	out := make([]rowSummary, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowSummary{ID: r.ID, Name: r.Name, Stopped: r.Stopped})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

const twoProxies = `[
  {"name":"a","type":"tcp","localPort":22,"remotePort":6000},
  {"name":"b","type":"tcp","localPort":80,"remotePort":6001}
]`

// BUG-14: the lookup used to match OriginClientID against the child client id, so it
// never found the old row and every rebuild re-created every row under a new ID.
func TestRebuildProxyConfigKeepsRowIdentity(t *testing.T) {
	ctx, db := newTestDB(t)
	m := NewMutation(ctx)

	if err := m.RebuildProxyConfigFromClient(testUser, childClient(twoProxies)); err != nil {
		t.Fatalf("first rebuild: %v", err)
	}
	first := proxyRows(t, db)
	if len(first) != 2 {
		t.Fatalf("after first rebuild: %+v, want rows a and b", first)
	}

	if err := m.RebuildProxyConfigFromClient(testUser, childClient(twoProxies)); err != nil {
		t.Fatalf("second rebuild: %v", err)
	}
	if second := proxyRows(t, db); !equalRows(first, second) {
		t.Fatalf("rebuild changed row identity:\n before %+v\n after  %+v", first, second)
	}
}

// A stopped proxy is absent from the client config, which is why the rebuild's delete
// spares stopped rows. When the same name comes back into the config (editing a stopped
// proxy does that today), the rebuild must update that row, not add a second one.
func TestRebuildProxyConfigDoesNotDuplicateStoppedRow(t *testing.T) {
	ctx, db := newTestDB(t)
	stopped := insertProxyRow(t, db, "a", true)

	if err := NewMutation(ctx).RebuildProxyConfigFromClient(testUser, childClient(twoProxies)); err != nil {
		t.Fatalf("rebuild: %v", err)
	}

	rows := proxyRows(t, db)
	if len(rows) != 2 || rows[0].Name != "a" || rows[1].Name != "b" {
		t.Fatalf("rows = %+v, want exactly one a and one b", rows)
	}
	if rows[0].ID != stopped.ID || rows[0].Stopped {
		t.Fatalf("row a = %+v, want the existing row %d, now running because it is in the config", rows[0], stopped.ID)
	}
}

// Databases written before the fix can already hold the duplicate. The next rebuild
// has to collapse it, so no separate data migration is needed.
func TestRebuildProxyConfigHealsExistingDuplicate(t *testing.T) {
	ctx, db := newTestDB(t)
	stopped := insertProxyRow(t, db, "a", true)
	insertProxyRow(t, db, "a", false)

	if err := NewMutation(ctx).RebuildProxyConfigFromClient(testUser, childClient(twoProxies)); err != nil {
		t.Fatalf("rebuild: %v", err)
	}

	rows := proxyRows(t, db)
	if len(rows) != 2 || rows[0].Name != "a" || rows[1].Name != "b" {
		t.Fatalf("rows = %+v, want the duplicate collapsed to one a, plus b", rows)
	}
	if rows[0].ID != stopped.ID || rows[0].Stopped {
		t.Fatalf("row a = %+v, want the oldest row %d kept, running", rows[0], stopped.ID)
	}
}

func TestRebuildProxyConfigKeepsStoppedRowsOutsideConfig(t *testing.T) {
	ctx, db := newTestDB(t)
	stopped := insertProxyRow(t, db, "c", true)
	insertProxyRow(t, db, "gone", false)

	if err := NewMutation(ctx).RebuildProxyConfigFromClient(testUser, childClient(twoProxies)); err != nil {
		t.Fatalf("rebuild: %v", err)
	}

	rows := proxyRows(t, db)
	want := []string{"a", "b", "c"}
	if len(rows) != len(want) {
		t.Fatalf("rows = %+v, want names %v (the running row dropped from config must be deleted)", rows, want)
	}
	for i, name := range want {
		if rows[i].Name != name {
			t.Fatalf("rows = %+v, want names %v", rows, want)
		}
	}
	if rows[2].ID != stopped.ID || !rows[2].Stopped {
		t.Fatalf("stopped row = %+v, want row %d untouched and still stopped", rows[2], stopped.ID)
	}
}

func TestRebuildProxyConfigRejectsInvalidConfigWithoutTouchingRows(t *testing.T) {
	ctx, db := newTestDB(t)
	insertProxyRow(t, db, "a", false)
	before := proxyRows(t, db)

	bad := childClient(`[{"name":"a","type":"tcp","remotePort":6000,"noSuchField":1}]`)
	if err := NewMutation(ctx).RebuildProxyConfigFromClient(testUser, bad); err == nil {
		t.Fatal("rebuild accepted a config the strict decoder must reject")
	}
	if after := proxyRows(t, db); !equalRows(before, after) {
		t.Fatalf("failed rebuild modified rows:\n before %+v\n after  %+v", before, after)
	}
}

func equalRows(a, b []rowSummary) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

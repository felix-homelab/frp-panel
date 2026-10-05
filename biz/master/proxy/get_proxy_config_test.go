package proxy

import (
	"testing"

	"github.com/VaalaCat/frp-panel/models"
)

func TestLocalProxyStatus(t *testing.T) {
	cases := []struct {
		name       string
		stopped    bool
		content    string
		wantStatus string
		wantKnown  bool
	}{
		{"stopped wins over content", true, `{"name":"a","type":"tcp","enabled":true}`, "stopped", true},
		{"stopped with unreadable content", true, `not json`, "stopped", true},
		{"enabled false", false, `{"name":"a","type":"tcp","enabled":false}`, "disabled", true},
		{"enabled true asks the agent", false, `{"name":"a","type":"tcp","enabled":true}`, "", false},
		{"enabled absent asks the agent", false, `{"name":"a","type":"tcp"}`, "", false},
		{"unreadable content asks the agent", false, `not json`, "", false},
		{"empty content asks the agent", false, ``, "", false},
		{"unknown proxy type asks the agent", false, `{"name":"a","type":"nope","enabled":false}`, "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := &models.ProxyConfig{ProxyConfigEntity: &models.ProxyConfigEntity{
				Stopped: tc.stopped,
				Content: []byte(tc.content),
			}}
			status, known := localProxyStatus(p)
			if status != tc.wantStatus || known != tc.wantKnown {
				t.Fatalf("localProxyStatus = (%q, %v), want (%q, %v)", status, known, tc.wantStatus, tc.wantKnown)
			}
		})
	}
}

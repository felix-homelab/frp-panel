package main

import (
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"
)

type leafText struct{ v string }

func (l leafText) MarshalText() ([]byte, error) { return []byte(l.v), nil }

type inlineBase struct {
	Name string `json:"name"`
}

type nested struct {
	Port int `json:"port,omitempty"`
}

type sample struct {
	inlineBase                     // untagged embed: inlined
	Tagged     *nested             `json:"tagged"`
	List       []nested            `json:"list"`
	Strings    []string            `json:"strings"`
	Meta       map[string]string   `json:"meta"`
	Text       leafText            `json:"text"`
	When       time.Time           `json:"when"` // has its own marshalling
	Skipped    string              `json:"-"`
	Untagged   bool                // Go name
	Any        interface{}         `json:"any"`
	hidden     string              //nolint:unused // unexported: skipped
	Named      inlineBase          `json:"named"` // tagged embed-like field: nested
	Deep       map[string][]nested `json:"deep"`
}

func TestFieldPaths(t *testing.T) {
	got := fieldPaths(reflect.TypeFor[sample]())
	want := []string{
		"Untagged", "any", "deep", "list[].port", "meta", "name", "named.name",
		"strings[]", "tagged.port", "text", "when",
	}
	if !slices.Equal(got, want) {
		t.Fatalf("fieldPaths:\n got  %v\n want %v", got, want)
	}
}

type loop struct {
	Next *loop `json:"next"`
	ID   int   `json:"id"`
}

func TestFieldPathsStopsOnRecursion(t *testing.T) {
	got := fieldPaths(reflect.TypeFor[loop]())
	if !slices.Equal(got, []string{"id", "next"}) {
		t.Fatalf("fieldPaths = %v", got)
	}
}

// Pins facts the matrix relies on, against the frp actually linked in.
func TestCurrentPathsAgainstLinkedFrp(t *testing.T) {
	paths, err := currentPaths()
	if err != nil {
		t.Fatal(err)
	}
	has := func(p string) bool { return slices.Contains(paths, p) }

	for _, p := range []string{
		"client transport.wireProtocol",
		"client featureGates",
		"server httpPlugins[].ops[]",
		"proxy.http requestHeaders.set",
		"proxy.http responseHeaders.set",
		"proxy.tcp enabled",
		"proxy.https plugin", // typed plugin wrapper: a leaf, its options are plugin.* roots
		"plugin.https2http enableHTTP2",
		"plugin.http2http requestHeaders.set",
		"visitor.xtcp natTraversal.disableAssistedAddrs",
		// TLSConfig is embedded without a tag, so its fields sit next to `enable`.
		"client transport.tls.certFile",
	} {
		if !has(p) {
			t.Errorf("missing %q", p)
		}
	}

	// PLG-04: frp's plugins have no responseHeaders; only HTTPProxyConfig does.
	for _, p := range paths {
		if strings.HasPrefix(p, "plugin.") && strings.Contains(p, "responseHeaders") {
			t.Errorf("unexpected %q", p)
		}
	}
	if has("client transport.tls.tls.certFile") {
		t.Error("TLSConfig is nested, not inlined (BUG-05 shape)")
	}
}

func TestDiff(t *testing.T) {
	added, removed := diff([]string{"a", "b"}, map[string]bool{"b": true, "c": true})
	if !slices.Equal(added, []string{"a"}) || !slices.Equal(removed, []string{"c"}) {
		t.Fatalf("diff = %v, %v", added, removed)
	}
	added, removed = diff(nil, map[string]bool{})
	if len(added)+len(removed) != 0 {
		t.Fatalf("empty diff = %v, %v", added, removed)
	}
}

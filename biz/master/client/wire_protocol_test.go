package client

import (
	"strings"
	"testing"
)

func fixed(v string) func() string { return func() string { return v } }

func mustNotCall(t *testing.T) func() string {
	return func() string {
		t.Helper()
		t.Fatal("agent was pinged although wireProtocol v2 was not requested")
		return ""
	}
}

func TestCheckWireProtocolV1NeverPings(t *testing.T) {
	for _, wire := range []string{"", "v1"} {
		if err := checkWireProtocol(wire, true, mustNotCall(t), mustNotCall(t)); err != nil {
			t.Errorf("wireProtocol %q rejected: %v", wire, err)
		}
	}
}

func TestCheckWireProtocolRejectsUnknownValue(t *testing.T) {
	for _, wire := range []string{"v3", "V2", "2"} {
		err := checkWireProtocol(wire, false, mustNotCall(t), mustNotCall(t))
		if err == nil || !strings.Contains(err.Error(), "must be v1 or v2") {
			t.Errorf("wireProtocol %q: err = %v, want an invalid-value error", wire, err)
		}
	}
}

func TestCheckWireProtocolV2(t *testing.T) {
	cases := []struct {
		name           string
		external       bool
		client, server string
		wantErr        string // substring; "" means accepted
	}{
		{"both new enough", false, "0.70.1", "0.69.0", ""},
		{"external frps", true, "0.70.1", "0.70.1", "external frps"},
		{"old client agent", false, "0.68.0", "0.70.1", "client agent"},
		{"client agent offline or too old to report", false, "", "0.70.1", "no frp version"},
		{"old server agent", false, "0.70.1", "0.65.0", "server agent"},
		{"server agent unknown", false, "0.70.1", "", "server agent"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := checkWireProtocol("v2", tc.external, fixed(tc.client), fixed(tc.server))
			switch {
			case tc.wantErr == "" && err != nil:
				t.Fatalf("rejected: %v", err)
			case tc.wantErr != "" && (err == nil || !strings.Contains(err.Error(), tc.wantErr)):
				t.Fatalf("err = %v, want one mentioning %q", err, tc.wantErr)
			}
		})
	}
}

// An external frps must be refused before anything is pinged: there is no agent behind it.
func TestCheckWireProtocolExternalDoesNotPing(t *testing.T) {
	if err := checkWireProtocol("v2", true, mustNotCall(t), mustNotCall(t)); err == nil {
		t.Fatal("v2 accepted for an external frps")
	}
}

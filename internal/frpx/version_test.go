package frpx

import "testing"

func TestVersionAtLeast(t *testing.T) {
	cases := []struct {
		v, min string
		want   bool
	}{
		{"0.70.1", "0.69.0", true},
		{"0.69.0", "0.69.0", true},
		{"0.69", "0.69.0", true},
		{"v0.69.0", "0.69.0", true},
		{"0.68.9", "0.69.0", false},
		{"0.9.0", "0.69.0", false}, // numeric, not lexical
		{"1.0.0", "0.69.0", true},
		{"0.69.0-rc1", "0.69.0", true}, // suffix ignored
		{" 0.70.1 ", "0.69.0", true},
		// fail closed
		{"", "0.69.0", false},
		{"dev-build", "0.69.0", false},
		{"0.x.1", "0.69.0", false},
		{"0.69.0.1", "0.69.0", false},
		{"0.-1.0", "0.0.0", false},
		{"0.70.1", "", false},
	}
	for _, tc := range cases {
		if got := VersionAtLeast(tc.v, tc.min); got != tc.want {
			t.Errorf("VersionAtLeast(%q, %q) = %v, want %v", tc.v, tc.min, got, tc.want)
		}
	}
}

func TestSupportsWireProtocolV2(t *testing.T) {
	if !SupportsWireProtocolV2(Version()) {
		t.Fatalf("this build's frp %q should support wireProtocol v2", Version())
	}
	for _, v := range []string{"", "0.68.0", "unknown"} {
		if SupportsWireProtocolV2(v) {
			t.Errorf("SupportsWireProtocolV2(%q) = true, want false", v)
		}
	}
}

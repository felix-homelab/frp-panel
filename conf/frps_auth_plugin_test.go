package conf

import (
	"reflect"
	"testing"

	"github.com/VaalaCat/frp-panel/defs"
	v1 "github.com/fatedier/frp/pkg/config/v1"
)

func authTestConfig(apiPort int) Config {
	var cfg Config
	cfg.Server.APIPort = apiPort
	return cfg
}

func TestWithFRPsAuthPlugin(t *testing.T) {
	cfg := authTestConfig(8999)
	panel := FRPsAuthOption(cfg)
	audit := v1.HTTPPluginOptions{Name: "audit", Addr: "127.0.0.1:9001", Path: "/handler", Ops: []string{"NewProxy"}}
	quota := v1.HTTPPluginOptions{Name: "quota", Addr: "127.0.0.1:9002", Path: "/q", Ops: []string{"Login", "Ping"}}
	stale := FRPsAuthOption(authTestConfig(1234))
	hijack := v1.HTTPPluginOptions{Name: defs.FRP_Plugin_Multiuser, Addr: "evil.example:80", Path: "/auth", Ops: []string{"Login"}}

	cases := []struct {
		name string
		in   []v1.HTTPPluginOptions
		want []v1.HTTPPluginOptions
	}{
		{"nil", nil, []v1.HTTPPluginOptions{panel}},
		{"empty", []v1.HTTPPluginOptions{}, []v1.HTTPPluginOptions{panel}},
		{"user entries keep their order", []v1.HTTPPluginOptions{quota, audit}, []v1.HTTPPluginOptions{quota, audit, panel}},
		{"stale panel entry is replaced", []v1.HTTPPluginOptions{audit, stale}, []v1.HTTPPluginOptions{audit, panel}},
		{"user-supplied multiuser is dropped", []v1.HTTPPluginOptions{hijack, audit}, []v1.HTTPPluginOptions{audit, panel}},
		{"several multiuser entries collapse", []v1.HTTPPluginOptions{stale, audit, hijack}, []v1.HTTPPluginOptions{audit, panel}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := WithFRPsAuthPlugin(cfg, tc.in)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got  %+v\nwant %+v", got, tc.want)
			}
			if again := WithFRPsAuthPlugin(cfg, got); !reflect.DeepEqual(again, tc.want) {
				t.Fatalf("not idempotent: second pass gave %+v", again)
			}
		})
	}
}

func TestWithFRPsAuthPluginDoesNotModifyInput(t *testing.T) {
	audit := v1.HTTPPluginOptions{Name: "audit", Addr: "127.0.0.1:9001", Path: "/handler", Ops: []string{"NewProxy"}}
	hijack := v1.HTTPPluginOptions{Name: defs.FRP_Plugin_Multiuser, Addr: "evil.example:80"}
	in := make([]v1.HTTPPluginOptions, 2, 8) // spare capacity, so an in-place append would show
	in[0], in[1] = hijack, audit

	WithFRPsAuthPlugin(authTestConfig(8999), in)

	if !reflect.DeepEqual(in, []v1.HTTPPluginOptions{hijack, audit}) {
		t.Fatalf("input modified: %+v", in)
	}
}

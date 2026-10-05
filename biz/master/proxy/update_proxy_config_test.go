package proxy

import (
	"reflect"
	"testing"

	"github.com/VaalaCat/frp-panel/defs"
	"github.com/VaalaCat/frp-panel/models"
	v1 "github.com/fatedier/frp/pkg/config/v1"
	"github.com/samber/lo"
)

// fullHTTPProxy sets every field BUG-08 used to drop, so a regression shows up as a
// diff rather than as a silently-zero field nobody looked at.
func fullHTTPProxy(annotations map[string]string) *v1.HTTPProxyConfig {
	return &v1.HTTPProxyConfig{
		ProxyBaseConfig: v1.ProxyBaseConfig{
			Name:        "web",
			Type:        string(v1.ProxyTypeHTTP),
			Enabled:     lo.ToPtr(false),
			Annotations: annotations,
			Transport: v1.ProxyTransport{
				UseEncryption:        true,
				ProxyProtocolVersion: "v2",
			},
			LoadBalancer: v1.LoadBalancerConfig{Group: "user-group", GroupKey: "user-key"},
			HealthCheck: v1.HealthCheckConfig{
				Type:            "http",
				TimeoutSeconds:  3,
				MaxFailed:       2,
				IntervalSeconds: 10,
				Path:            "/healthz",
			},
			ProxyBackend: v1.ProxyBackend{
				LocalIP:   "10.0.0.5",
				LocalPort: 8080,
				Plugin: v1.TypedClientPluginOptions{
					Type:                "http2https",
					ClientPluginOptions: &v1.HTTP2HTTPSPluginOptions{Type: "http2https", LocalAddr: "127.0.0.1:443"},
				},
			},
		},
		DomainConfig: v1.DomainConfig{CustomDomains: []string{"a.example.com"}, SubDomain: "a"},
		Locations:    []string{"/"},
	}
}

func typed(c v1.ProxyConfigurer) v1.TypedProxyConfig {
	return v1.TypedProxyConfig{Type: c.GetBaseConfig().Type, ProxyConfigurer: c}
}

func TestUpdateWorkerLoadBalancerGroupKeepsEveryField(t *testing.T) {
	annotations := map[string]string{
		defs.FrpProxyAnnotationsKey_Ingress:  "true",
		defs.FrpProxyAnnotationsKey_WorkerId: "worker-1",
	}
	got := UpdateWorkerLoadBalancerGroup(typed(fullHTTPProxy(annotations)))

	gotHTTP, ok := got.ProxyConfigurer.(*v1.HTTPProxyConfig)
	if !ok {
		t.Fatalf("configurer type changed to %T", got.ProxyConfigurer)
	}

	want := fullHTTPProxy(annotations)
	want.LoadBalancer = v1.LoadBalancerConfig{
		Group:    models.HttpIngressLBGroup("worker-1", want),
		GroupKey: "worker-1",
	}
	if !reflect.DeepEqual(gotHTTP, want) {
		t.Fatalf("config changed beyond loadBalancer:\n got  %+v\n want %+v", gotHTTP, want)
	}
}

func TestUpdateWorkerLoadBalancerGroupLeavesOtherProxiesAlone(t *testing.T) {
	cases := map[string]map[string]string{
		"no annotations":         nil,
		"ingress without worker": {defs.FrpProxyAnnotationsKey_Ingress: "true"},
		"worker without ingress": {defs.FrpProxyAnnotationsKey_WorkerId: "worker-1"},
		"empty worker id": {
			defs.FrpProxyAnnotationsKey_Ingress:  "true",
			defs.FrpProxyAnnotationsKey_WorkerId: "",
		},
	}
	for name, annotations := range cases {
		t.Run(name, func(t *testing.T) {
			got := UpdateWorkerLoadBalancerGroup(typed(fullHTTPProxy(annotations)))
			if !reflect.DeepEqual(got.ProxyConfigurer, fullHTTPProxy(annotations)) {
				t.Fatalf("non-worker proxy was modified: %+v", got.ProxyConfigurer)
			}
		})
	}
}

// The old implementation rebuilt *any* input as an HTTPProxyConfig, so a non-http
// proxy reaching it would have changed type.
func TestUpdateWorkerLoadBalancerGroupIgnoresNonHTTP(t *testing.T) {
	tcp := &v1.TCPProxyConfig{
		ProxyBaseConfig: v1.ProxyBaseConfig{
			Name: "ssh",
			Type: string(v1.ProxyTypeTCP),
			Annotations: map[string]string{
				defs.FrpProxyAnnotationsKey_Ingress:  "true",
				defs.FrpProxyAnnotationsKey_WorkerId: "worker-1",
			},
		},
		RemotePort: 6000,
	}
	got := UpdateWorkerLoadBalancerGroup(typed(tcp))
	if got.ProxyConfigurer != tcp || tcp.LoadBalancer != (v1.LoadBalancerConfig{}) {
		t.Fatalf("tcp proxy was modified: %+v", got.ProxyConfigurer)
	}

	empty := UpdateWorkerLoadBalancerGroup(v1.TypedProxyConfig{})
	if empty.ProxyConfigurer != nil {
		t.Fatalf("nil configurer was replaced with %T", empty.ProxyConfigurer)
	}
}

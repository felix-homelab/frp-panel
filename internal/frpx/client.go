package frpx

import (
	"github.com/fatedier/frp/client"
	"github.com/fatedier/frp/client/proxy"
	"github.com/fatedier/frp/pkg/config/source"
	v1 "github.com/fatedier/frp/pkg/config/v1"
	"github.com/fatedier/frp/pkg/config/v1/validation"
	"github.com/fatedier/frp/pkg/policy/featuregate"
)

// ClientService is a running frpc.
type ClientService = client.Service

// ProxyWorkingStatus is the runtime status of a single proxy on the client side.
type ProxyWorkingStatus = proxy.WorkingStatus

// ClientOptions is frp-panel's stable view of frp's client.ServiceOptions.
//
// frp restructured ServiceOptions in v0.68: ProxyCfgs/VisitorCfgs were removed and a
// config-source aggregator became mandatory. This struct keeps the original shape so the
// call site in services/client does not move with frp.
type ClientOptions struct {
	Common      *v1.ClientCommonConfig
	ProxyCfgs   []v1.ProxyConfigurer
	VisitorCfgs []v1.VisitorConfigurer
}

// NewClientService constructs an frpc service. It does not start it.
//
// The aggregator is deliberately left with only a config source. frp's other source is
// the frpc-local store ([store] in frpc.toml, new in v0.68), which frp-panel must not
// enable: the store persists proxies frpc-side and the aggregator merges them back in,
// which would resurrect proxies the master has deleted.
func NewClientService(o ClientOptions) (*ClientService, error) {
	cfgSource := source.NewConfigSource()
	if err := cfgSource.ReplaceAll(o.ProxyCfgs, o.VisitorCfgs); err != nil {
		return nil, err
	}

	return client.NewService(client.ServiceOptions{
		Common:                 o.Common,
		ConfigSourceAggregator: source.NewAggregator(cfgSource),
	})
}

// SetFeatureGates enables or disables frp feature gates process-wide.
func SetFeatureGates(m map[string]bool) error {
	return featuregate.SetFromMap(m)
}

// ValidateClientConfig validates a complete frpc config. The first return is a
// non-fatal warning; the second is a fatal error.
//
// The nil unsafe-feature set (added as a parameter in v0.68) means no opt-in unsafe
// feature is permitted. frp's only such feature is TokenSourceExec, which runs an
// external command to fetch an OIDC token; frp-panel does not use it. The nil is safe:
// UnsafeFeatures.IsEnabled guards against a nil receiver.
func ValidateClientConfig(
	c *v1.ClientCommonConfig,
	proxyCfgs []v1.ProxyConfigurer,
	visitorCfgs []v1.VisitorConfigurer,
) (error, error) {
	warning, err := validation.ValidateAllClientConfig(c, proxyCfgs, visitorCfgs, nil)
	return warning, err
}

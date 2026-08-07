package frpx

import (
	"github.com/fatedier/frp/client"
	"github.com/fatedier/frp/client/proxy"
	v1 "github.com/fatedier/frp/pkg/config/v1"
	"github.com/fatedier/frp/pkg/config/v1/validation"
	"github.com/fatedier/frp/pkg/featuregate"
)

// ClientService is a running frpc.
type ClientService = client.Service

// ProxyWorkingStatus is the runtime status of a single proxy on the client side.
type ProxyWorkingStatus = proxy.WorkingStatus

// ClientOptions is frp-panel's stable view of frp's client.ServiceOptions.
//
// frp restructured ServiceOptions in v0.68 (ProxyCfgs/VisitorCfgs were replaced by a
// required config-source aggregator). This struct keeps the original shape so the call
// site in services/client does not move with frp.
type ClientOptions struct {
	Common      *v1.ClientCommonConfig
	ProxyCfgs   []v1.ProxyConfigurer
	VisitorCfgs []v1.VisitorConfigurer
}

// NewClientService constructs an frpc service. It does not start it.
func NewClientService(o ClientOptions) (*ClientService, error) {
	return client.NewService(client.ServiceOptions{
		Common:      o.Common,
		ProxyCfgs:   o.ProxyCfgs,
		VisitorCfgs: o.VisitorCfgs,
	})
}

// SetFeatureGates enables or disables frp feature gates process-wide.
func SetFeatureGates(m map[string]bool) error {
	return featuregate.SetFromMap(m)
}

// ValidateClientConfig validates a complete frpc config. The first return is a
// non-fatal warning; the second is a fatal error.
func ValidateClientConfig(
	c *v1.ClientCommonConfig,
	proxyCfgs []v1.ProxyConfigurer,
	visitorCfgs []v1.VisitorConfigurer,
) (error, error) {
	warning, err := validation.ValidateAllClientConfig(c, proxyCfgs, visitorCfgs)
	return warning, err
}

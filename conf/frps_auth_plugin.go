package conf

import (
	"github.com/VaalaCat/frp-panel/defs"
	v1 "github.com/fatedier/frp/pkg/config/v1"
	"github.com/samber/lo"
)

// WithFRPsAuthPlugin returns plugins with the panel's own `multiuser` entry as the last
// element and no other entry by that name.
//
// frps calls that entry back to authenticate every login, so it is owned by the panel:
// a stored copy can be stale (the server API port moved) and a user-supplied one would
// redirect authentication. Every other entry is a user's own plugin and is kept, in
// order. The master and the Server agent both apply this, so the result must be stable
// when applied twice. The input slice is not modified.
func WithFRPsAuthPlugin(cfg Config, plugins []v1.HTTPPluginOptions) []v1.HTTPPluginOptions {
	userPlugins := lo.Filter(plugins, func(item v1.HTTPPluginOptions, _ int) bool {
		return item.Name != defs.FRP_Plugin_Multiuser
	})
	return append(userPlugins, FRPsAuthOption(cfg))
}

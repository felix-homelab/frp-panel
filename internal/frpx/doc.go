// Package frpx is the single seam between frp-panel and the frp library.
//
// # Why this package exists
//
// frp-panel is a fork. Every file it edits that upstream also owns is a permanent
// rebase cost, paid again on every merge from upstream. frp itself makes breaking
// changes to its non-config packages across minor releases.
//
// frpx concentrates both costs into one directory that upstream does not have, so:
//
//   - Upgrading frp touches this package plus go.mod, and nothing else.
//   - Rebasing onto upstream/main can never conflict here, because upstream has no
//     internal/frpx to conflict with.
//
// # The rule
//
// Wrap *behavior*, pass *data* through.
//
// Every frp import that is NOT "pkg/config/v1" belongs in this package. Calls into
// pkg/config/v1 *behavior* (the Complete methods) also belong here, because that is
// where frp actually breaks compatibility.
//
// The v1.* config structs themselves are deliberately NOT wrapped, and are imported
// directly by the ~22 files that need them. Aliasing them would give zero insulation
// (an alias is the identical type), and wrapping them for real would break both the
// database blob format (models/proxy_config.go stores cfg.MarshalJSON()) and the
// frontend JSON contract. Across frp v0.65.0 -> v0.70.1, pkg/config/v1 produced only
// additive field changes plus two Complete() signature changes -- and those are
// behavior, which is exactly what this package absorbs.
//
// # Signature stability
//
// Exported signatures here are chosen so they can be implemented against multiple frp
// versions without the call sites changing. Where that requires keeping a parameter frp
// no longer needs, the parameter is kept on purpose and documented at the call. Freezing
// a call site in an upstream-owned file is worth an unused argument in a fork-owned one.
//
// # Currently pinned
//
//	github.com/fatedier/frp   v0.65.0
//	github.com/fatedier/golib v0.5.1
//
// # Upgrade checklist
//
// These are every frp symbol frp-panel depends on. Re-verify each one when bumping frp,
// then run `go test -tags integration ./internal/frpx/...`.
//
//	client.Service                      client.go
//	client.ServiceOptions               client.go   <- restructured in v0.68
//	client.NewService                   client.go
//	client.Service.Run/Close            client.go
//	client.Service.GracefulClose        client.go
//	client.Service.StatusExporter       client.go
//	client.Service.UpdateAllConfigurer  client.go
//	client/proxy.WorkingStatus          client.go
//	pkg/featuregate.SetFromMap          client.go   <- moved to pkg/policy/featuregate in v0.68
//	pkg/config/v1/validation            client.go, server.go
//	server.Service                      server.go
//	server.NewService                   server.go
//	pkg/metrics.EnableMem/Prometheus    server.go
//	pkg/metrics/mem.StatsCollector      server.go
//	pkg/metrics/mem.ServerStats         server.go
//	pkg/metrics/mem.ProxyStats          server.go
//	pkg/config.Values/GetValues         config.go
//	pkg/config.RenderWithTemplate       config.go
//	pkg/config.LoadConfigure            config.go
//	v1.ProxyConfigurer.Complete         config.go   <- lost its argument in v0.68
//	v1.VisitorConfigurer.Complete       config.go   <- lost its argument in v0.68
//	pkg/plugin/server.Request/Response  plugin.go
//	pkg/plugin/server.LoginContent      plugin.go
//	pkg/msg.NewProxy                    msg.go
//	pkg/util/log.Logger                 log.go
//
// Proxy naming (naming.go) is a behavioral contract rather than a symbol: through frp
// v0.67 the "{user}." prefix was applied to config during Complete(); from v0.68 the
// config keeps the raw name and the prefix is applied at the wire layer. The wire name
// is identical either way. See naming.go.
package frpx

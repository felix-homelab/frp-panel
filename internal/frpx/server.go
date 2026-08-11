package frpx

import (
	v1 "github.com/fatedier/frp/pkg/config/v1"
	"github.com/fatedier/frp/pkg/config/v1/validation"
	"github.com/fatedier/frp/pkg/metrics"
	"github.com/fatedier/frp/pkg/metrics/mem"
	"github.com/fatedier/frp/server"
)

// ServerService is a running frps.
type ServerService = server.Service

// ServerStats is a point-in-time snapshot of frps-wide counters.
type ServerStats = mem.ServerStats

// ProxyStats is a point-in-time snapshot of one proxy's counters.
//
// Note that ProxyStats.Name is the *wire* proxy name, so it carries the "{user}."
// prefix. See naming.go.
type ProxyStats = mem.ProxyStats

// NewServerService constructs an frps service. It does not start it.
func NewServerService(cfg *v1.ServerConfig) (*ServerService, error) {
	return server.NewService(cfg)
}

// ValidateServerConfig validates an frps config. The first return is a non-fatal
// warning; the second is a fatal error.
//
// frp moved this from a package function to a method on a validator type in v0.68. The
// nil unsafe-feature set means no opt-in unsafe feature is permitted; see
// ValidateClientConfig in client.go for why that is the right default here.
func ValidateServerConfig(cfg *v1.ServerConfig) (error, error) {
	warning, err := validation.NewConfigValidator(nil).ValidateServerConfig(cfg)
	return warning, err
}

// EnableMemMetrics turns on frp's in-memory stats collector. It must be called before
// any frps starts, and it mutates process-global state.
func EnableMemMetrics() {
	metrics.EnableMem()
}

// EnablePrometheusMetrics turns on frp's Prometheus collector. Same constraints as
// EnableMemMetrics.
func EnablePrometheusMetrics() {
	metrics.EnablePrometheus()
}

// ServerStatsSnapshot returns current frps-wide counters.
func ServerStatsSnapshot() *ServerStats {
	return mem.StatsCollector.GetServer()
}

// ProxyStatsByType returns current counters for every proxy of the given type.
func ProxyStatsByType(proxyType v1.ProxyType) []*ProxyStats {
	return mem.StatsCollector.GetProxiesByType(string(proxyType))
}

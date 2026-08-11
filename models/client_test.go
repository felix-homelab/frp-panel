package models_test

import (
	"testing"

	"github.com/VaalaCat/frp-panel/models"
	"github.com/VaalaCat/frp-panel/utils"
	v1 "github.com/fatedier/frp/pkg/config/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// An xtcp visitor with every XTCP-specific field set to a non-default value. All six
// live on XTCPVisitorConfig, not on VisitorBaseConfig, so a base-config downcast in the
// serializer drops them without error.
const xtcpVisitorClientConfig = `{
  "user": "alice",
  "serverAddr": "127.0.0.1",
  "serverPort": 7000,
  "proxies": [
    {"name": "stcp-proxy", "type": "stcp", "secretKey": "sk", "localIP": "127.0.0.1", "localPort": 22}
  ],
  "visitors": [
    {
      "name": "xtcp-visitor",
      "type": "xtcp",
      "serverName": "xtcp-proxy",
      "secretKey": "sk",
      "bindAddr": "127.0.0.1",
      "bindPort": 9001,
      "protocol": "kcp",
      "keepTunnelOpen": true,
      "maxRetriesAnHour": 3,
      "minRetryInterval": 30,
      "fallbackTo": "stcp-visitor",
      "fallbackTimeoutMs": 250
    }
  ]
}`

func loadClientConfig(t *testing.T, raw string) *v1.ClientConfig {
	t.Helper()
	cfg, err := utils.LoadClientConfigNormal([]byte(raw), true)
	require.NoError(t, err)
	require.NotNil(t, cfg)
	return cfg
}

// SetConfigContent used to marshal visitors as []v1.VisitorBaseConfig, which silently
// discarded every XTCP-specific field. Because it is called from every proxy create /
// update / delete / start / stop and from tenant tunnel sync, editing any proxy on a
// client wiped that client's xtcp visitor tuning.
func TestSetConfigContentPreservesXTCPVisitor(t *testing.T) {
	cfg := loadClientConfig(t, xtcpVisitorClientConfig)

	entity := &models.ClientEntity{}
	require.NoError(t, entity.SetConfigContent(*cfg))

	got, err := entity.GetConfigContent()
	require.NoError(t, err)
	require.Len(t, got.Visitors, 1)

	xtcp, ok := got.Visitors[0].VisitorConfigurer.(*v1.XTCPVisitorConfig)
	require.True(t, ok, "visitor decoded as %T, want *v1.XTCPVisitorConfig", got.Visitors[0].VisitorConfigurer)

	assert.Equal(t, "kcp", xtcp.Protocol)
	assert.True(t, xtcp.KeepTunnelOpen)
	assert.Equal(t, 3, xtcp.MaxRetriesAnHour)
	assert.Equal(t, 30, xtcp.MinRetryInterval)
	assert.Equal(t, "stcp-visitor", xtcp.FallbackTo)
	assert.Equal(t, 250, xtcp.FallbackTimeoutMs)

	// The base fields must survive too.
	assert.Equal(t, "xtcp-visitor", xtcp.Name)
	assert.Equal(t, "xtcp-proxy", xtcp.ServerName)
	assert.Equal(t, 9001, xtcp.BindPort)
}

// Set -> Get -> Set must be a fixed point, otherwise repeated proxy edits would keep
// mutating the stored blob.
func TestSetConfigContentIsIdempotent(t *testing.T) {
	cfg := loadClientConfig(t, xtcpVisitorClientConfig)

	first := &models.ClientEntity{}
	require.NoError(t, first.SetConfigContent(*cfg))

	roundTripped, err := first.GetConfigContent()
	require.NoError(t, err)

	second := &models.ClientEntity{}
	require.NoError(t, second.SetConfigContent(*roundTripped))

	assert.Equal(t, string(first.ConfigContent), string(second.ConfigContent))
}

// Proxies were never affected by the visitor bug, but they share the serializer, so
// pin the behaviour.
func TestSetConfigContentPreservesProxies(t *testing.T) {
	cfg := loadClientConfig(t, xtcpVisitorClientConfig)

	entity := &models.ClientEntity{}
	require.NoError(t, entity.SetConfigContent(*cfg))

	got, err := entity.GetConfigContent()
	require.NoError(t, err)
	require.Len(t, got.Proxies, 1)

	stcp, ok := got.Proxies[0].ProxyConfigurer.(*v1.STCPProxyConfig)
	require.True(t, ok, "proxy decoded as %T, want *v1.STCPProxyConfig", got.Proxies[0].ProxyConfigurer)
	assert.Equal(t, "stcp-proxy", stcp.Name)
	assert.Equal(t, "sk", stcp.Secretkey)
	assert.Equal(t, 22, stcp.LocalPort)
}

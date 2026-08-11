package utils_test

import (
	"testing"

	"github.com/VaalaCat/frp-panel/utils"
	v1 "github.com/fatedier/frp/pkg/config/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfigureFromContent(t *testing.T) {
	content := []byte(`[[proxies]]
name = "ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 6000`)

	allCfg := &v1.ClientConfig{}

	if err := utils.LoadConfigureFromContent(content, allCfg, true); err != nil {
		t.Error(err)
	}
	t.Logf("%+v", allCfg)
}

// frp's own duplicate-name check lives in the path-based loader, which frp-panel never
// calls. Without the explicit check the duplicate is not rejected -- frp's ConfigSource
// keys entries by name in a map, so the second one silently replaces the first.
func TestLoadClientConfigRejectsDuplicateProxyNames(t *testing.T) {
	const cfg = `{
      "serverAddr": "127.0.0.1", "serverPort": 7000,
      "proxies": [
        {"name": "dup", "type": "tcp", "localPort": 22, "remotePort": 6000},
        {"name": "dup", "type": "tcp", "localPort": 23, "remotePort": 6001}
      ]
    }`

	_, err := utils.LoadClientConfigNormal([]byte(cfg), true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "duplicate proxy name: dup")

	_, _, _, err = utils.LoadClientConfig([]byte(cfg), true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "duplicate proxy name: dup")
}

func TestLoadClientConfigRejectsDuplicateVisitorNames(t *testing.T) {
	const cfg = `{
      "serverAddr": "127.0.0.1", "serverPort": 7000,
      "visitors": [
        {"name": "dup", "type": "stcp", "serverName": "a", "secretKey": "s", "bindPort": 9001},
        {"name": "dup", "type": "stcp", "serverName": "b", "secretKey": "s", "bindPort": 9002}
      ]
    }`

	_, err := utils.LoadClientConfigNormal([]byte(cfg), true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "duplicate visitor name: dup")
}

// Names are scoped per kind, matching frp: a proxy and a visitor may share one.
func TestLoadClientConfigAllowsProxyAndVisitorSharingAName(t *testing.T) {
	const cfg = `{
      "serverAddr": "127.0.0.1", "serverPort": 7000,
      "proxies": [{"name": "same", "type": "stcp", "secretKey": "s", "localPort": 22}],
      "visitors": [{"name": "same", "type": "stcp", "serverName": "other", "secretKey": "s", "bindPort": 9001}]
    }`

	got, err := utils.LoadClientConfigNormal([]byte(cfg), true)
	require.NoError(t, err)
	assert.Len(t, got.Proxies, 1)
	assert.Len(t, got.Visitors, 1)
}

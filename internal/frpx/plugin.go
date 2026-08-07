package frpx

import "github.com/fatedier/frp/pkg/plugin/server"

// frps server-plugin HTTP contract.
//
// frp-panel registers itself as an frps "multiuser" server plugin (see conf/helper.go)
// so that frps calls back into the panel to authenticate every tunnel login. These are
// the types on that HTTP boundary.

// PluginRequest is the envelope frps POSTs to a server plugin.
type PluginRequest = server.Request

// PluginResponse is what a server plugin returns to frps.
type PluginResponse = server.Response

// PluginLoginContent is the payload of a Login operation.
type PluginLoginContent = server.LoginContent

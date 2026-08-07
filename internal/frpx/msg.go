package frpx

import "github.com/fatedier/frp/pkg/msg"

// NewProxyMsg is frp's on-the-wire proxy registration message.
//
// Caution: this type carries only the subset of proxy configuration that frp sends to
// frps. Round-tripping a v1 proxy config through it (MarshalToMsg then UnmarshalFromMsg)
// silently discards every field it does not model -- LocalIP, LocalPort, Plugin,
// HealthCheck, and, from frp v0.66, Enabled. It is not a clone vehicle.
type NewProxyMsg = msg.NewProxy

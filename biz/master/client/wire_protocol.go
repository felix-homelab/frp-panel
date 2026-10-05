package client

import (
	"fmt"

	"github.com/VaalaCat/frp-panel/internal/frpx"
	"github.com/VaalaCat/frp-panel/pb"
	"github.com/VaalaCat/frp-panel/services/app"
	"github.com/VaalaCat/frp-panel/services/rpc"
	"google.golang.org/protobuf/proto"
)

// checkWireProtocol is the authoritative gate for frpc transport.wireProtocol (BUMP-07).
// The form offers v2 only when it looks safe; this check is what makes it safe, because
// a wrong v2 fails silently -- the tunnel just never comes up:
//
//   - frpc older than v0.69 rejects the unknown key, so the agent drops the whole config;
//   - frps older than v0.69 cannot parse a v2 session.
//
// An external frps (frpsUrl) has no agent to ask, so v2 is always refused for it. The
// version lookups are functions so that nothing is pinged unless v2 is requested.
func checkWireProtocol(wireProtocol string, externalFrps bool, clientFrpVersion, serverFrpVersion func() string) error {
	switch wireProtocol {
	case "", "v1":
		return nil
	case "v2":
	default:
		// frp's own validation would reject it on the agent, after the old config is gone.
		return fmt.Errorf("invalid transport.wireProtocol %q, must be v1 or v2", wireProtocol)
	}

	if externalFrps {
		return fmt.Errorf("transport.wireProtocol v2 is not allowed with an external frps url: its frp version cannot be verified")
	}
	if v := clientFrpVersion(); !frpx.SupportsWireProtocolV2(v) {
		return fmt.Errorf("transport.wireProtocol v2 needs frp >= v0.69 on the client agent, which reports %s", describeFrpVersion(v))
	}
	if v := serverFrpVersion(); !frpx.SupportsWireProtocolV2(v) {
		return fmt.Errorf("transport.wireProtocol v2 needs frp >= v0.69 on the server agent, which reports %s", describeFrpVersion(v))
	}
	return nil
}

func describeFrpVersion(v string) string {
	if v == "" {
		return "no frp version (offline, or older than this check)"
	}
	return fmt.Sprintf("frp %s", v)
}

// agentFrpVersion asks a connected agent which frp it is built with. "" means unknown:
// the agent is offline, did not answer, or predates pb.ClientVersion.FrpVersion.
func agentFrpVersion(c *app.Context, agentID string) string {
	resp, err := rpc.CallClient(c, agentID, pb.Event_EVENT_PING, &pb.CommonRequest{})
	if err != nil || resp == nil {
		return ""
	}
	v := &pb.ClientVersion{}
	if err := proto.Unmarshal(resp.GetData(), v); err != nil {
		return ""
	}
	return v.GetFrpVersion()
}

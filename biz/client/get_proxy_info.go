package client

import (
	"fmt"

	"github.com/VaalaCat/frp-panel/internal/frpx"
	"github.com/VaalaCat/frp-panel/pb"
	"github.com/VaalaCat/frp-panel/services/app"
	"github.com/VaalaCat/frp-panel/utils/logger"
	"github.com/samber/lo"
)

// lookupProxyStatus resolves a proxy by whichever name form frpc happens to key it by.
//
// The master sends the wire name ("{user}.{name}", see biz/master/proxy/get_proxy_config.go),
// but the client-side status map is keyed by the *config* name, and frp moved where the
// user prefix is applied in v0.68: through v0.67 Complete rewrote Name to "{user}.{name}",
// so the key was the wire name; from v0.68 the name stays raw and prefixing happens at the
// wire layer. Trying both forms keeps this working against either frp generation, which
// matters during a staged rollout when an upgraded agent may still be talking to an
// older master (or the reverse).
func lookupProxyStatus(cli app.ClientHandler, proxyName string) (*frpx.ProxyWorkingStatus, bool) {
	if st, ok := cli.GetProxyStatus(proxyName); ok {
		return st, true
	}

	var user string
	if common := cli.GetCommonCfg(); common != nil {
		user = common.User
	}
	if user == "" {
		return nil, false
	}

	if st, ok := cli.GetProxyStatus(frpx.RawProxyName(user, proxyName)); ok {
		return st, true
	}
	return cli.GetProxyStatus(frpx.WireProxyName(user, proxyName))
}

func GetProxyConfig(c *app.Context, req *pb.GetProxyConfigRequest) (*pb.GetProxyConfigResponse, error) {
	var (
		clientID  = req.GetClientId()
		serverID  = req.GetServerId()
		proxyName = req.GetName()
	)

	ctrl := c.GetApp().GetClientController()
	cli := ctrl.Get(clientID, serverID)
	if cli == nil {
		logger.Logger(c).Errorf("cannot get client, clientID: [%s], serverID: [%s]", clientID, serverID)
		return nil, fmt.Errorf("cannot get client")
	}
	workingStatus, ok := lookupProxyStatus(cli, proxyName)
	if !ok {
		logger.Logger(c).Errorf("cannot get proxy status, client: [%s], server: [%s], proxy name: [%s]", clientID, serverID, proxyName)
		return nil, fmt.Errorf("cannot get proxy status")
	}

	return &pb.GetProxyConfigResponse{
		Status: &pb.Status{Code: pb.RespCode_RESP_CODE_SUCCESS, Message: "success"},
		WorkingStatus: &pb.ProxyWorkingStatus{
			Name:       lo.ToPtr(workingStatus.Name),
			Type:       lo.ToPtr(workingStatus.Type),
			Status:     lo.ToPtr(workingStatus.Phase),
			Err:        lo.ToPtr(workingStatus.Err),
			RemoteAddr: lo.ToPtr(workingStatus.RemoteAddr),
		},
	}, nil
}

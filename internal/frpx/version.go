package frpx

import (
	"strconv"
	"strings"

	"github.com/fatedier/frp/pkg/util/version"
)

// Version is the frp library version compiled into this binary, e.g. "0.70.1".
//
// Agents report it to the master (pb.ClientVersion.FrpVersion), which is the only way
// the master can learn what an agent's frp understands: the panel's own GitVersion says
// nothing about which frp it was built against.
func Version() string {
	return version.Full()
}

// minWireProtocolV2 is the first frp release whose frpc can send, and whose frps can
// accept, transport.wireProtocol "v2". Older frpc rejects the key outright (the config
// decoder is strict), and older frps cannot parse a v2 session.
const minWireProtocolV2 = "0.69.0"

// SupportsWireProtocolV2 reports whether an agent built with frp version v can take part
// in a wireProtocol v2 session. An empty or unparsable version is treated as too old.
func SupportsWireProtocolV2(v string) bool {
	return VersionAtLeast(v, minWireProtocolV2)
}

// VersionAtLeast compares dotted numeric versions such as "0.70.1" or "v0.69". A
// pre-release or build suffix ("-rc1", "+meta") is ignored. It fails closed: if either
// side does not parse, the answer is false.
func VersionAtLeast(v, min string) bool {
	have, ok := parseVersion(v)
	if !ok {
		return false
	}
	want, ok := parseVersion(min)
	if !ok {
		return false
	}
	for i := range have {
		if have[i] != want[i] {
			return have[i] > want[i]
		}
	}
	return true
}

func parseVersion(v string) ([3]int, bool) {
	var out [3]int
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	if i := strings.IndexAny(v, "-+"); i >= 0 {
		v = v[:i]
	}
	if v == "" {
		return out, false
	}
	parts := strings.Split(v, ".")
	if len(parts) > len(out) {
		return out, false
	}
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return out, false
		}
		out[i] = n
	}
	return out, true
}

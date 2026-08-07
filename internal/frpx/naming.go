package frpx

import "strings"

// Proxy naming across frp versions.
//
// frp namespaces proxies per user. A proxy named "ssh" belonging to user "alice" is
// "alice.ssh" as far as frps is concerned. Where that prefix gets applied moved in
// frp v0.68:
//
//	                        frp <= v0.67        frp >= v0.68
//	config Name after Complete   alice.ssh           ssh
//	client-side status map key   alice.ssh           ssh
//	wire msg.NewProxy.ProxyName  alice.ssh           alice.ssh   <- unchanged
//	frps mem.ProxyStats.Name     alice.ssh           alice.ssh   <- unchanged
//
// The wire name is identical in both, which is why tunnels interoperate across the
// version gap. What changed is the key frp-panel must use to look a proxy up on the
// *client* side. Use these helpers at any point where a name crosses between
// frp-panel's own records and frp's runtime.

// WireProxyName returns the name frps knows a proxy by: "{user}.{name}".
// With an empty user the name is unchanged.
func WireProxyName(user, name string) string {
	if user == "" {
		return name
	}
	return user + "." + name
}

// RawProxyName strips a leading "{user}." from a wire proxy name, returning the name as
// authored. It is a no-op if the prefix is absent, so it is safe to apply to a name that
// may already be raw.
func RawProxyName(user, name string) string {
	if user == "" {
		return name
	}
	return strings.TrimPrefix(name, user+".")
}

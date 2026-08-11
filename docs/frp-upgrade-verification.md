# Verifying an frp upgrade

What to check when `github.com/fatedier/frp` moves in `go.mod`, and in what order to roll
the result out.

This document is fork-local (`felix-homelab/frp-panel`) and is not part of the published
VitePress site.

## 1. Automated: the tunnel matrix

`internal/frpx/tunnel_integration_test.go` stands up a real frps and a real frpc in one
process and pushes real bytes through every supported tunnel type. It is the only test in
the repository that exercises a tunnel.

```bash
mkdir -p cmd/frpp/out && touch cmd/frpp/out/.gitkeep   # satisfies //go:embed all:out
go build ./...
go test ./conf/... ./models/... ./services/wg/... ./utils/... ./internal/...
go test -tags integration -run TestTunnelMatrix -v -timeout 5m ./internal/frpx/...
```

Covers **tcp, udp, http, https, stcp, sudp, tcpmux**. `xtcp` is skipped by default because
NAT hole punching is unreliable on loopback — verify it manually (§3) or attempt it with
`FRPX_TEST_XTCP=1`.

> `go test ./...` is **not** a valid gate. `services/workerd.TestRunWorker` hardcodes
> `/home/coder/...` paths and fails everywhere except the original author's dev container.
> That failure is pre-existing and unrelated to any upgrade.

### The assertion that is supposed to fail

The `proxy name correlation` subtest pins how proxy names flow. It is the intended tripwire
for an frp bump, and it failed **by design** when this repo crossed frp v0.68:

|                              | frp ≤ v0.67 | frp ≥ v0.68 |
|------------------------------|-------------|-------------|
| config `Name` after Complete | `alice.ssh` | `ssh`       |
| client status map key        | `alice.ssh` | `ssh`       |
| wire `msg.NewProxy.ProxyName`| `alice.ssh` | `alice.ssh` |
| frps `mem.ProxyStats.Name`   | `alice.ssh` | `alice.ssh` |

The **wire name is unchanged**, which is why tunnels keep interoperating across the gap.
What moves is the key frp-panel must use for a *client-side* status lookup.

**Status: crossed at frp v0.70.1.** The v0.65.0 → v0.70.1 bump confirmed the table above
empirically — the subtest now logs `raw("tcp-test")=true wire("alice.tcp-test")=false`
while frps still reports `alice.tcp-test`. Two things were done in response, and both
remain the current state:

- The subtest's client-side expectations were inverted to the frp ≥ v0.68 semantics.
- `biz/client/get_proxy_info.go` gained `lookupProxyStatus`, which tries the name as sent
  and then both `frpx.RawProxyName` and `frpx.WireProxyName`. The master still sends the
  *wire* name (`biz/master/proxy/get_proxy_config.go`), so the agent — not the master — is
  what absorbs the difference, which keeps mixed-version fleets working during a rollout.

If this subtest fails again on a future bump, that is the finding: flip the assertion and
re-check that lookup. The visible symptom of getting it wrong is every proxy showing
**`error`** in the panel's status column — `biz/master/proxy/get_proxy_config.go` sets that
whenever the client RPC misses.

### Collateral: the Go floor and quic-go

frp v0.70.1 requires **Go 1.25**. Bumping `go.mod` past a Go release means the four
upstream workflows that hardcode `go-version` (`master`, `tag`, `master-merge-check`,
`workerd-docker-tag`) need the same bump; `fork-checks.yml` reads `go-version-file: go.mod`
and follows automatically.

frp also drags `quic-go` forward, and `github.com/imroc/req/v3` compiles against quic-go's
internal HTTP/3 surface. frp v0.70.1 pulled quic-go v0.60.0, which broke `req v3.55.0`
(`undefined: quic.ConnectionTracingID`). The fix is to move `req` in the same commit —
v3.60.0 resolves it. **Expect to bump `req` whenever frp bumps quic-go.**

## 2. Build gate

```bash
./build.sh --current     # closest local reproduction of CI
cd www && pnpm lint      # the only linter CI runs
```

## 3. Manual: the UI and API path

The Go test proves the frp layer. It does not prove frp-panel's HTTP API, the database
round-trip, or the UI.

Note that **`https`, `tcpmux`, `xtcp` and `sudp` have no form in the UI** — the proxy form
dispatcher only renders `tcp`, `udp`, `http` and `stcp`, so these types must be created
through the raw-JSON **Advanced** editor or the API. (Tracked as `BUG-03` / `PT-01`…`PT-04`
in [`FEATURE-MATRIX.md`](../FEATURE-MATRIX.md).)

Bring up a Master, register a Server and a Client, then for each type below paste the
payload into the proxy **Advanced** editor and confirm the result.

**What to look for in every case: the working-status column reads `running`, not `error`.**
`error` there is the signature of the name-correlation break.

```jsonc
// tcp
{ "name": "t-tcp", "type": "tcp", "localIP": "127.0.0.1", "localPort": 22, "remotePort": 6022 }

// udp
{ "name": "t-udp", "type": "udp", "localIP": "127.0.0.1", "localPort": 53, "remotePort": 6053 }

// http  — needs frps vhostHTTPPort
{ "name": "t-http", "type": "http", "localIP": "127.0.0.1", "localPort": 8080,
  "customDomains": ["http.example.com"] }

// https — needs frps vhostHTTPSPort (not settable in the UI: FS-01)
{ "name": "t-https", "type": "https", "customDomains": ["https.example.com"],
  "plugin": { "type": "https2http", "localAddr": "127.0.0.1:8080",
              "crtPath": "/etc/frpp/tls.crt", "keyPath": "/etc/frpp/tls.key" } }

// tcpmux — needs frps tcpmuxHTTPConnectPort (not settable in the UI: FS-07)
{ "name": "t-mux", "type": "tcpmux", "multiplexer": "httpconnect",
  "customDomains": ["mux.example.com"], "localIP": "127.0.0.1", "localPort": 22 }

// stcp — plus a visitor on the consuming client
{ "name": "t-stcp", "type": "stcp", "secretKey": "s3cret",
  "localIP": "127.0.0.1", "localPort": 22 }

// xtcp — plus a visitor; needs a reachable STUN server (natHoleStunServer, FC-05)
{ "name": "t-xtcp", "type": "xtcp", "secretKey": "s3cret",
  "localIP": "127.0.0.1", "localPort": 22 }
```

Visitors have **no UI at all** (§6 of the feature matrix), so stcp/sudp/xtcp verification
means editing the client's raw config:

```jsonc
"visitors": [
  { "name": "v-stcp", "type": "stcp", "serverName": "t-stcp",
    "secretKey": "s3cret", "bindAddr": "127.0.0.1", "bindPort": 9000 }
]
```

> ⚠ Adding a visitor by hand then touching **any** proxy on that client will silently strip
> every xtcp-specific visitor field (`protocol`, `keepTunnelOpen`, `fallbackTo`, …). That is
> `BUG-01`, pre-existing and independent of any upgrade — but it will confuse an xtcp
> verification if you hit it unaware.

## 4. Rollout order

frp v0.69 introduced a formal compatibility policy: each minor is supported until nine
newer minors exist, and **frps should be upgraded before frpc**. At the current pin
(v0.70.1) that window runs to v0.79.0, so a v0.70 frpc and an frps anywhere from v0.61
upward interoperate — mixed-version fleets are safe for the duration of a rollout.

For frp-panel, where Master, Server and Client are the same binary deployed as separate
long-lived processes:

1. **Server nodes** (they run the public-facing frps)
2. **Master**
3. **Clients**

Master's only frp surface is the `pkg/plugin/server` types and the `pkg/config/v1` structs,
so a newer Master serves older clients without issue.

**OTA caveat.** `biz/common/upgrade/` lets a client upgrade itself, independently of the
Master. Prefer holding the client rollout until Master and every frps node are done — but
once `biz/client/get_proxy_info.go` accepts both proxy-name forms, an out-of-order client
upgrade is cosmetically harmless rather than status-breaking.

## 5. Things that must not change quietly

- **`transport.wireProtocol` must stay `v1`.** A v2 frpc **cannot connect to an older
  frps**, and this project upgrades frps and frpc independently. frp's default is still
  `v1` (`ClientTransportConfig.Complete()` fills it in), and the field is typed in
  `www/types/client.ts` for raw-config editing only — do **not** surface it as a UI control
  without a server-version check.
- **`enabled` is tri-state.** frp models `ProxyBaseConfig.Enabled` / `VisitorBaseConfig.Enabled`
  as `*bool` with `omitempty`: absent or `true` means enabled, and only an explicit `false`
  disables. Anything that writes these configs must omit the key rather than default it to
  `false`, or it will silently disable every proxy it touches. The proxy form routes this
  through `enabledToConfigValue` in `www/components/frpc/proxy_form.tsx`. Note this is
  distinct from the panel's own `ProxyConfig.Stopped`, which is what the list's start/stop
  action drives — the two can disagree.
- **Do not adopt frpc's `[store]` config source.** frp's aggregator merges the store with
  the pushed config, so a persisted store would resurrect proxies the Master deleted.
- **Watch for restart loops.** `biz/server/rpc_pull_config.go`, `biz/server/update_tunnel.go`
  and `biz/client/rpc_pull_config.go` compare configs to decide whether to recreate frps/frpc.
  A field that `Complete()` fills non-deterministically would make that comparison always
  differ and drive an unbounded restart loop. Symptom: tunnels flapping on the config-pull
  interval with a repeating "config changed, will recreate it" log line.

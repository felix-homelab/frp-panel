# frp Feature Gap Matrix

> **frp-panel @ `eec2a63`+working tree · frp v0.70.1 · go 1.25.0 · reviewed 2026-08-11**

This is the project's backlog: every `frp` capability that frp-panel does not surface, scored and
prioritized. Rows are stable handles — reference them from commits, issues, and PRs.

## The one thing to understand first

**frp-panel does not model frp config in protobuf or in the database.** Client, server, and proxy
configs cross the wire and land in the DB as an **opaque JSON blob** — `pb.Client.config`,
`pb.Server.config`, and `pb.ProxyConfig.config` are all `optional string`
(`idl/common.proto:39,54,88`), stored as `ConfigContent []byte` (`models/client.go:21-39`,
`models/server.go:17-29`, `models/proxy_config.go:21-31`). The Go side hands that blob to frp's own
strict `config/v1` loader (`utils/load.go`).

**So the backend accepts 100% of frp's configuration surface, and always has.** Every `gap` row in
this document is a **UI/UX gap, not a capability gap** — anything listed here can be configured
today through the raw-JSON "Advanced" editors:

- `www/components/frpc/frpc_editor.tsx` — frpc common config
- `www/components/frps/frps_editor.tsx` — frps config
- `www/components/proxy/mutate_proxy_config.tsx` — per-proxy config (Advanced toggle)

What you buy by closing a gap is **discoverability and safety**, not new capability.

**Three things that are *not* true of the raw editors, and bound how much they can be leaned on:**

1. The loader runs with `DisallowUnknownFields`, all the way into each proxy and visitor element.
   One misspelled key rejects the whole config.
2. When the agent rejects a config it has **already stopped and deleted** the previous handler
   (`biz/client/update_tunnel.go:29-31`), so an invalid push takes that client's whole tunnel set
   down until the next valid one. The panic is recovered; the outage is not.
3. `zodResolver` hands `handleSubmit` the *parsed* object and zod strips unknown keys. Any structured
   form that submits `values` alone therefore deletes every key it does not itself model. This was a
   live data-loss bug in both structured forms (BUG-06, BUG-07) and is the reason both now merge over
   the stored config rather than replacing it. **Any new form must do the same.**

## How to read this

| Column | Meaning |
|---|---|
| **ID** | Stable handle. Never reused after a row is removed. |
| **Feature** | The frp field path, verbatim — greppable against frp's docs and pasteable into the raw-JSON editor. |
| **St** | Status, see below. |
| **D** | Difficulty 1–5. |
| **V** | User value 1–5. |
| **P** | Priority bucket, derived. |

**Status:** `gap` not in the UI, raw-JSON only · `partial` some UI exists, incomplete ·
`reserved` the backend overwrites it — **do not** turn it into a user field · `bug` the code actively
does the wrong thing · `won't-do` deliberately rejected, with the reason recorded.

**Difficulty**, anchored to this codebase:

| D | Means |
|---|---|
| **1** | One key in an existing zod schema + one primitive from `www/components/base/form-field.tsx` + 2 i18n keys. ~15 lines, no backend. |
| **2** | A new form section or sub-component, a new field primitive, or a new interface in `www/types/*.ts`. Still frontend-only. |
| **3** | A new top-level form wired into an existing switch, plus validator / preview / dropdown plumbing. |
| **4** | A new UI surface with its own CRUD path over existing RPC: new page or dialog, new `www/api/*` functions, new i18n namespace. |
| **5** | Cross-cutting: new proto messages and/or an `AutoMigrate` change and/or a new agent RPC event. `idl/*.proto` + `./codegen.sh` + `models/` + `biz/`. |

> If a change requires touching `idl/`, it is at least a D4.

**Value.** Because the raw-JSON escape hatch reaches everything, **no `gap` can score V5 on
capability grounds.** V5 means broken, silently lossy, or advertised-but-unusable.

**Priority:** `P = 2V − D`, bucketed **P1** ≥ 7 · **P2** 4–6 · **P3** ≤ 3. `bug` rows are **P0**.

---

## 0. Bugs — P0

| ID | Issue | St | D | V |
|---|---|---|---|---|
| **BUG-08** | **`UpdateWorkerLoadBalancerGroup` destroys six fields on every http proxy update.** `biz/master/proxy/update_proxy_config.go:139-163` round-trips the config through `frpx.NewProxyMsg` (`msg.NewProxy`) and rebuilds a fresh `HTTPProxyConfig`. `msg.NewProxy` carries none of `enabled`, `transport.proxyProtocolVersion`, `healthCheck.*`, `localIP`, `localPort`, `plugin`. **Latent only** because `updateProxyConfig` (`www/api/proxy.ts:31`) has zero frontend callers — the edit path goes through `createProxyConfig({overwrite: true})`. Strictly worse than BUG-01 was. | bug | 2 | 5 |
| **BUG-09** | **frp-level `enabled` and panel-level `ProxyConfig.Stopped` are independent and can disagree.** The proxy list's start/stop action drives `Stopped`; the form switch drives `enabled`. A proxy can read "running" in the list while frp has it disabled, or vice versa. Needs a decision on which is authoritative, not just a display fix. | bug | 3 | 3 |

### Closed in this pass

`BUG-01` visitor fields dropped by `SetConfigContent` (`models/client.go`) — fixed, with
`models/client_test.go` as the regression gate · `BUG-02` raw-JSON proxy creation silently refused ·
`BUG-03` blank panel for unhandled proxy types · `BUG-04` frps `httpPlugins` de-dup no-op ·
`BUG-05` `www/types/client.ts` drift — all four faults, including **(d)** `TLSClientConfig.tls`
being nested when frp inlines it (`transport.tls.tls.certFile` was a hard load failure) ·
**BUG-06** (new) the frpc structured form deleted every config key outside `{proxies, transport}` ·
**BUG-07** (new) the frps structured form had the identical defect · **BUG-10** (new) duplicate
proxy/visitor names collapsed silently — frp's own check lives in the path-based loader this
codebase never calls, so `utils.ValidateNoDuplicateNames` now mirrors it · **BUG-11** (new)
`UpdateFrpsHander` never validated the config it stored, so a decodable-but-invalid frps config
(bad `log.level`, bad `httpPlugins.ops`) was a remote-reachable panic on the Server agent.

---

## 1. Proxy types — closed

All **8** frp proxy types now have a form and appear in both type pickers. `stcp`/`xtcp`/`sudp` share
one parametrized `SecretProxyForm`; `TypedProxyForm` has a `default` branch so an unrecognized type
explains itself instead of rendering blank.

The per-type forms moved from `proxy_form.tsx` into `www/components/frpc/proxy_forms/` — a
fork-owned directory upstream has no counterpart for, so it cannot produce a rebase conflict, while
`proxy_form.tsx` stays at its original path as a thin dispatcher.

> **Watch out when adding a ninth type:** `coerceProxyConfigToType`
> (`proxy_forms/shared/build.ts`) must learn its key set. Without it, switching type in the create
> dialog carries the previous type's keys along and the strict decoder rejects the whole config.

---

## 2. Per-proxy fields — closed

`transport.*` (encryption, compression, bandwidth limit + mode, PROXY protocol), `healthCheck.*`,
`loadBalancer.*`, `hostHeaderRewrite`, `requestHeaders`, `routeByHTTPUser`, `metadatas`,
`annotations` and `allowUsers` are all reachable, as collapsed accordion groups shared across the
eight type forms (`proxy_forms/shared/sections.tsx`).

Two panel-owned hazards are guarded, and **must stay guarded**:

- **Worker-ingress load balancer groups.** The panel writes `loadBalancer.group =
  "lb-group-<workerId>-<md5>"`. The fields render disabled for worker-managed proxies, and a zod
  refine rejects the `lb-group-` prefix elsewhere.
- **Reserved annotations.** `models/proxy_config.go:71-81` derives the `worker_id` DB column from
  `annotations`, so clobbering them orphans the worker link. Reserved keys never enter the editor,
  are shown as disabled badges, and are re-applied unconditionally in `buildProxyConfig`.

---

## 3. Client plugins

All 9 frp client plugins have forms (`www/components/frpc/plugins/`). `virtual_net` is the tenth and
is deliberately absent.

| ID | Feature | St | D | V | P |
|---|---|---|---|---|---|
| PLG-04 | `requestHeaders` / `responseHeaders` on http2http, http2https, https2http, https2https | gap | 2 | 2 | P3 |
| PLG-05 | Wire up the `supportedPlugins` narrowing prop — declared at `client_plugins.tsx:40`, passed by no caller, so e.g. an `https` proxy is offered `static_file` | gap | 1 | 2 | P3 |
| PLG-03 | `virtual_net` plugin form | won't-do | — | — | — |

> **PLG-03 is blocked by design, not by effort.** `virtual_net` is alpha and gated off by default in
> frp, and the gate (`featureGates`) is applied **process-globally** by the agent
> (`services/client/frpc_service.go:33-37`). A per-client field would silently affect every other
> frpc in that agent. The correct surface would be an agent-level setting in `conf/settings.go`
> (`CLIENT_*` env, like the existing `CLIENT_FEATURES_ENABLE_FUNCTIONS`) — see FC-08.

---

## 4. frpc common config

Now an RHF form with accordion sections (`www/components/frpc/form/`). Closed: **FC-01** TLS,
**FC-02** connection tuning, **FC-03** `proxyURL`/`connectServerLocalIP`, **FC-04** QUIC,
**FC-05** `natHoleStunServer`/`dnsServer`, **FC-07** log + agent web server, and the
`loginFailExit`/`udpPacketSize`/`metadatas` part of **FC-09**.

| ID | Feature | St | Why |
|---|---|---|---|
| FC-06 | `auth.{method,token,oidc.*}` | won't-do | frp-panel authenticates through the frps `multiuser` HTTP plugin plus `user` + `metadatas[token]`. frps runs the built-in verifier *as well*, and it passes today only because both ends have an empty token. Setting a token on one side without atomically setting it on every frpc bound to that server drops every tunnel at once — and `update_tunnel.go` writes one client at a time, so a form field guarantees an outage window. See **FS-06** for the replacement proposal. |
| FC-08 | `featureGates`, `virtualNet.address` | won't-do (as a per-client field) | Process-global on the agent, as above. Documented in `www/types/client.ts` so it is visible to anyone auditing from the TS mirror. Belongs in `conf/settings.go` if ever wanted. |
| FC-09 | `start[]` | won't-do | Superseded by frp's per-proxy `enabled`, which the panel already wires. Three overlapping enable mechanisms (`start[]`, `enabled`, `ProxyConfig.Stopped`) is already one too many — see **BUG-09**. `utils/load.go:82-90` keeps the filter for raw-editor compatibility. |
| FC-10 | `includes[]` | won't-do | Resolves paths on the agent's filesystem. frp-panel's model is DB-sourced config pushed over gRPC, and `internal/frpx/config.go` never uses the path-based loader, so the key would be accepted and then silently ignored — worse than absent. |

---

## 5. frps config

Now an RHF form with accordion sections (`www/components/frps/form/`). Closed: **FS-01**
`vhostHTTPSPort` + `vhostHTTPTimeout` (the P1 row — `https` was an advertised proxy type whose
listener port could not be set), **FS-02** `allowPorts` + `maxPortsPerClient`, **FS-03** webServer +
Prometheus, **FS-04** transport + TLS, **FS-05** SSH tunnel gateway, **FS-07** tcpmux,
**FS-08** log + `detailedErrorsToClient`, **FS-09** `custom404Page`, **FS-10** the timing/size knobs.

| ID | Feature | St | D | V | P |
|---|---|---|---|---|---|
| FS-11 | `httpPlugins[]` — user-added entries | gap | 2 | 2 | P3 |
| FS-06 | `auth.{method,token,oidc.*}` | won't-do | — | — | — |
| **FS-12** | **Panel-managed shared auth token** — replaces FS-06/FC-06. Store one token on the `Server` record and have the backend inject it into the frps blob *and* every child frpc blob in one transaction, alongside `metadatas[token]`. This is the only way to set an frp auth token without an outage window. | gap | 4 | 3 | P2 |

> **FS-11 must preserve the panel's own entry.** `conf/helper.go:39-52` appends a `multiuser` plugin
> that frps calls back into to authenticate every tunnel; both `biz/master/server/update_tunnel.go`
> and `biz/server/rpc_pull_config.go` strip-and-re-append it. A UI must render it read-only, submit
> only user entries, and reject a user entry named `multiuser`. Note `ops` is validated by frp
> (`lo.Every(SupportedHTTPPluginOps, ...)`) — a bad value used to panic the Server agent, and now
> returns a form error thanks to BUG-11.

---

## 6. Visitors — closed

Visitor CRUD (**VIS-01**), xtcp tuning fields (**VIS-02**) and the proxy-pairing helper
(**VIS-03**) ship as a section inside the frpc card (`www/components/frpc/visitor_form.tsx`).

**No new proto and no new DB table were needed** — visitors already cross the wire inside
`UpdateFRPCRequest.config` and `biz/client/update_tunnel.go` already applies them.

> A top-level `/visitors` page **would** be a D5, not the D4 originally scored. `ProxyConfig` is a
> first-class table with a paginated endpoint; visitors have neither, and `ListClients` cannot
> substitute because `MakeClientShadowed` sets `ConfigContent = nil` on the origin client and the
> list response carries no usable `serverId`. Enumerating visitors across clients needs a new proto
> endpoint or a new table plus a `RebuildVisitorConfigFromClient` twin.

Two details that are load-bearing and easy to get wrong later:

- **`serverName` is the raw, unprefixed proxy name and `serverUser` stays empty.** frp builds the
  wire target as `BuildTargetServerProxyName(localUser, serverUser, serverName)`, which with an
  empty `serverUser` prefixes the visitor's *own* user — and the master forces every client's `user`
  to the panel account, so both sides always agree. `serverUser` only matters for cross-*user*
  access, which additionally needs `allowUsers` on the proxy. Proven by
  `internal/frpx/tunnel_integration_test.go:122-126`.
- **`fallbackTo` names a sibling *visitor*, not a proxy** (`client/visitor/xtcp.go:177`). The
  idiomatic target is an stcp visitor with `bindPort: -1`, which is why `ZodVisitorBindPortSchema`
  permits negatives and rejects only 0.

---

## 7. Reserved / not-a-gap — do not "fix" these

| Field | Why | Enforced at |
|---|---|---|
| frpc `serverAddr`, `serverPort` | Derived from the selected server, or from the frps URL. `serverPort` is chosen by protocol: kcp→`KCPBindPort`, quic→`QUICBindPort`, else `BindPort` | `biz/master/client/update_tunnel.go:98-106,137-138` |
| frpc `user` | Set to the panel account name. Also a security boundary — it namespaces proxy names on the wire and drives `allowUsers` | `biz/master/client/update_tunnel.go:143` |
| frpc `metadatas["token"]`, `metadatas["x-vaala-frp-client-id"]` | Panel auth + client identity. **Only these two keys** — the master *merges* rather than replaces, so user keys survive, which is why they are editable in the form | `biz/master/client/update_tunnel.go:145-150`, `defs/const.go:20,23` |
| frpc `transport.protocol` | **Exposed but mediated.** Users can set it, but the backend derives `serverPort` from it and the frps-URL path overwrites it from the URL scheme. Do not add a `serverPort` field alongside it | `biz/master/client/update_tunnel.go:98-150` |
| frps `httpPlugins[]` entry named `multiuser` | The panel's own auth plugin | `conf/helper.go:39-52` |
| frps form `publicHost` | **Not an frp field.** A panel-level value, stripped before submit and sent as the `server_ip` request param | `www/components/frps/frps_form.tsx` |
| frpc `store` | Deliberately disabled — a persisted agent-side store would resurrect proxies the master deleted | `internal/frpx/client.go:31-37` |

---

## 8. frp version-tracking rows

frp is pinned at **v0.70.1** (`go.mod:13`), go 1.25.0 (`go.mod:3`).

| ID | frp | Feature | St | D | V |
|---|---|---|---|---|---|
| BUMP-07 | 0.69 | `transport.wireProtocol` v1/v2 | partial | 3 | 3 |
| BUMP-04 | 0.67 | Native frpc `clientID`; retire `metadatas["x-vaala-frp-client-id"]` | gap | 3 | 3 |
| BUMP-03 | 0.66 | OIDC `tokenSource` | won't-do | — | 1 |

**BUMP-07 is shipped fail-closed and needs finishing.** The field, the enum and the description are
in place, but `allowWireProtocolV2` is hardcoded `false`, so `v2` is never offered. That is the
correct default — a `v2` frpc **cannot connect to an frps older than v0.69**, and the failure mode is
a tunnel that silently never comes up. To finish it: the panel already receives each Server agent's
`pb.ClientVersion.GitVersion` (`biz/server/rpc_handler.go:37`), and frp is pinned in `go.mod`, so the
agent's panel version determines its frp version. Add a `SupportsWireV2(version)` helper next to
`www/config/notify.ts`'s existing version-compare, and an authoritative backend check in
`biz/master/client/update_tunnel.go` — **outside** the frpsUrl branch, and rejecting `v2`
unconditionally when `frpsUrl` points at an external frps whose version cannot be known.

**BUMP-03 is unreachable**, not merely parked: `internal/frpx/{client,server}.go` pass a nil
`UnsafeFeatures`, and frp's only unsafe feature is `TokenSourceExec`. Only `tokenSource.file` could
ever work, and it depends on FC-06/FS-06, which are won't-do.

### Closed or rejected in this pass

`BUMP-00` frp v0.65.0 → v0.70.1 — **done** (commit `eec2a63`) · `BUMP-01` per-proxy `enabled` —
**done**, see BUG-09 for the follow-on · `BUMP-02` `loadBalancer` for https — **deleted**,
`loadBalancer` lives on `ProxyBaseConfig` so it always applied to every type; folded into PF-06 ·
`BUMP-05` frpc `[store]` — **rejected**, decision recorded in `internal/frpx/client.go:31-37` ·
`BUMP-06` `noweb` build tag — **rejected**, gates only frp's own `cmd/frps` and `cmd/frpc` mains,
which this codebase never imports, so there are zero bytes to gain · `BUMP-08` frps dashboard API v2
— **rejected**, the panel collects stats in-process via `mem.StatsCollector`, and its own
`HistoryProxyStats` survives frps restarts, spans servers and is tenant-scoped, none of which frps's
in-memory history does; adopting it would be a regression · `BUMP-09` binary WS frames — **done by
the bump**, no panel surface · `BUMP-10` duplicate name rejection — **done**, see BUG-10.

---

## Appendix: maintaining this file

**This file is hand-maintained. There is deliberately no generator.** The question a generator would
have to answer is *"is this field exposed in the UI?"*, and that is not mechanically derivable —
fields reach forms through zod schema keys, JSX `name=` props, object spreads, and the raw editor.

**One thing is worth automating, and still is not built.** A small `hack/frpdrift/main.go` (~60
lines, `reflect` only) can reflect over `v1.ClientCommonConfig`, `v1.ServerConfig`, every proxy and
visitor config type, and the client-plugin registry, emit the flat set of JSON field paths, and diff
it against the field names mentioned anywhere in this file. It answers exactly one question:

> *Has frp gained a field this matrix has never heard of?*

It is what would have caught `featureGates`, `virtualNet`, `clientID`, `store`,
`HTTPProxyConfig.responseHeaders`, `XTCPProxyConfig.natTraversal` and
`XTCPVisitorConfig.natTraversal.disableAssistedAddrs` — all of which were absent from both the TS
mirror and this matrix until the v0.70.1 review. Run on demand: `go run ./hack/frpdrift`.
Deliberately **not** wired into CI, because that would mean editing a shared workflow file.

**Conventions**

1. A PR that closes a row **deletes that row in the same PR**, moving it to the section's
   "Closed in this pass" note if the reasoning is worth keeping.
2. Refresh the header stamp on every edit. A stale stamp is an honest signal that the file is stale.
3. **Cap this file at ~80 rows.**
4. Scores are defaults, not mandates. Override a bucket when you have a reason, and write the reason.
5. **Any new structured form must merge over the stored config, never submit `values` alone** — see
   the third numbered point at the top of this file.

## Verification

`.github/workflows/fork-checks.yml` is the fork's own gate (a new file, so it cannot conflict with
upstream). It runs:

```bash
mkdir -p cmd/frpp/out && touch cmd/frpp/out/.gitkeep   # once per clone; the go:embed target
go build ./...
go vet ./conf/... ./internal/... ./services/... ./utils/... ./biz/...
go test ./conf/... ./models/... ./services/wg/... ./utils/... ./internal/...
go test -tags integration -run TestTunnelMatrix -timeout 5m ./internal/frpx/...
cd www && pnpm lint && pnpm build
```

Note the package list rather than `./...`: `services/workerd`'s `TestRunWorker` hardcodes
`/home/coder/...` paths and only passes in the original author's dev container. That is pre-existing.

`TestTunnelMatrix` (`internal/frpx/tunnel_integration_test.go`) stands up a live frps + frpc in one
process and pushes real bytes through all 8 proxy types and an stcp visitor. It is the real gate for
anything touching config shape.

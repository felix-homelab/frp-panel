# frp Feature Gap Matrix

> **frp-panel @ `1a58b85` · frp v0.65.0 · reviewed 2026-08-05**

This is the project's backlog: every `frp` capability that frp-panel does not surface, scored and
prioritized. Rows are stable handles — reference them from commits, issues, and PRs.

## The one thing to understand first

**frp-panel does not model frp config in protobuf or in the database.** Client, server, and proxy
configs cross the wire and land in the DB as an **opaque JSON blob** — `pb.Client.config`,
`pb.Server.config`, and `pb.ProxyConfig.config` are all `optional string`
(`idl/common.proto:39,54,88`), stored as `ConfigContent []byte` (`models/client.go:21-39`,
`models/server.go:17-29`, `models/proxy_config.go:21-31`). The Go side hands that blob straight to
frp's own strict `config/v1` loader (`utils/load.go`) and never validates it further.

**So the backend already accepts 100% of frp's configuration surface, and always has.** Every row in
this document is a **UI/UX gap, not a capability gap**. Anything listed here can be configured today
through the raw-JSON "Advanced" editors:

- `www/components/frpc/frpc_editor.tsx` — frpc common config
- `www/components/frps/frps_editor.tsx` — frps config
- `www/components/proxy/mutate_proxy_config.tsx` — per-proxy config (Advanced toggle)

What you buy by closing a gap is **discoverability and safety**, not new capability. That is why no
`gap` row scores V5 — V5 is reserved for things that are actually broken.

## How to read this

| Column | Meaning |
|---|---|
| **ID** | Stable handle. Never reused after a row is removed. |
| **Feature** | The frp field path, verbatim — greppable against frp's docs and pasteable into the raw-JSON editor. |
| **St** | Status, see below. |
| **D** | Difficulty 1–5. |
| **V** | User value 1–5. |
| **P** | Priority bucket, derived. |
| **Touch points** | The files to actually edit. |

**Status:** `gap` not in the UI, raw-JSON only · `partial` some UI exists, incomplete ·
`reserved` the backend overwrites it — **do not** turn it into a user field · `bug` the code actively
does the wrong thing · `bump` blocked on upgrading frp · `won't-do` deliberately rejected.

**Difficulty**, anchored to this codebase:

| D | Means |
|---|---|
| **1** | One key in an existing zod schema + one primitive from `www/components/base/form-field.tsx` + 2 i18n keys (en/zh). The TS type already declares it. ~15 lines, no backend. |
| **2** | A new form section or sub-component, a new field primitive (e.g. a key/value map editor), or a new interface in `www/types/*.ts`. Still frontend-only. |
| **3** | A new top-level form wired into an existing switch, plus validator / preview / dropdown plumbing — typically `www/lib/consts.ts` and `www/components/base/visit-preview.tsx` too. |
| **4** | A new UI surface with its own CRUD path over existing RPC: new page or dialog, new `www/api/*` functions, new i18n namespace. May need a Go serialization fix, but no new proto or DB. |
| **5** | Cross-cutting: new proto messages and/or an `AutoMigrate` change and/or a new agent RPC event. `idl/*.proto` + `./codegen.sh` + `models/` + `biz/`. |

> If a change requires touching `idl/`, it is at least a D4.

**Value.** Because the raw-JSON escape hatch reaches everything, **no `gap` can score V5 on
capability grounds.** V5 means broken, silently lossy, or advertised-but-unusable.

| V | Means |
|---|---|
| **5** | Happy-path breakage, data loss, or a visible dead end. |
| **4** | Common self-hosting need; raw JSON is a real barrier. |
| **3** | Regularly wanted by a subset; workaround is fine. |
| **2** | Niche or expert-only — and the expert will happily use raw JSON. |
| **1** | Nobody asks. Listed for completeness. |

**Priority:** `P = 2V − D`, bucketed **P1** ≥ 7 · **P2** 4–6 · **P3** ≤ 3. `bug` rows are **P0**
regardless of score. `reserved`, `bump`, and `won't-do` rows are parked and carry no bucket.

Value is weighted 2× deliberately: difficulty here is mostly 1–2, so an unweighted `V − D` would let
triviality outrank usefulness. A maintainer may override a bucket — state the reason in Notes.

---

## 0. Bugs — P0

These are defects, not gaps. They are listed first because three of them undermine the raw-JSON
escape hatch that the rest of this document leans on.

| ID | Issue | St | D | V | Touch points |
|---|---|---|---|---|---|
| **BUG-01** | **xtcp/sudp visitor fields silently dropped on every proxy CRUD operation.** `SetConfigContent` serializes visitors as `[]v1.VisitorBaseConfig` via `*item.GetBaseConfig()`, discarding every XTCP-specific field: `protocol`, `keepTunnelOpen`, `maxRetriesAnHour`, `minRetryInterval`, `fallbackTo`, `fallbackTimeoutMs`. A visitor authored in the raw editor loses them as soon as *any* proxy on that client is touched. | bug | 2 | 5 | `models/client.go:45-58` (`:49`, `:55-57`). Triggered from `biz/master/proxy/{create,update,delete,start,stop}_proxy_config.go` and `biz/master/client/sync_tunnel.go:30`. Correct path for contrast: `biz/master/client/update_tunnel.go:155-159` |
| **BUG-02** | **Raw-JSON proxy creation is silently refused.** The `disabled` prop correctly branches on `advancedMode`, but the `onClick` guard does not — so in Advanced mode the submit button looks enabled, then toasts "invalid config" and returns. It also only ever validates `proxyConfigs[0]`, so elements 1..n of a raw array are never checked. | bug | 1 | 4 | `www/components/proxy/mutate_proxy_config.tsx:203` (correct) vs `:205` (missing the branch); `TypedProxyConfigValid` in `www/lib/consts.ts:57-80` |
| **BUG-03** | **Editing an `https`, `tcpmux`, `xtcp`, or `sudp` proxy renders a blank panel.** The form dispatcher has branches for only `tcp`/`udp`/`http`/`stcp`; anything else matches no branch and renders an empty fragment, with no message explaining why. | bug | 1 | 4 | `www/components/frpc/proxy_form.tsx:75,86,97,108` — add a fallback branch pointing at Advanced/raw mode |
| **BUG-04** | **frps `httpPlugins` de-duplication is a no-op.** `lo.Filter` is called and its result thrown away, so the panel's own `multiuser` auth plugin is appended again on every save and accumulates duplicates. | bug | 1 | 3 | `biz/master/server/update_tunnel.go:45-48`. Correct form three lines away in `biz/server/rpc_pull_config.go:69` |
| **BUG-05** | **`www/types/client.ts` drift makes copy-pasted raw JSON fail to load.** Three separate faults: (a) `dialServerKeepAlive` — frp's JSON tag is `dialServerKeepalive`, lowercase `a`; (b) `ClientCommonConfig extends AuthClientConfig` inlines `method`/`token`/`oidc`/`additionalScopes` at the top level, but frp only accepts them nested under `auth`; (c) `AuthClientConfig` is declared **twice** (`:14` and `:47`) and TypeScript silently declaration-merges them — the `:47` block is plainly `ClientCommonConfig`'s member list and even contains a self-referential `auth?: AuthClientConfig`. Because the loader is strict, (a) and (b) are hard load failures. | bug | 1 | 3 | `www/types/client.ts:14,24,47,69` |

---

## 1. Proxy types

frp v0.65.0 has **8** proxy types. All 8 appear in `www/types/proxy.ts:59` and in the backend traffic
stats enum (`biz/server/rpc_push_proxy_info.go:13-21`). **Four render a form.**

| ID | Feature | St | D | V | P | Touch points | Notes |
|---|---|---|---|---|---|---|---|
| PT-01 | `https` proxy form | gap | 3 | 4 | P2 | `proxy_form.tsx`, `lib/consts.ts`, `base/visit-preview.tsx` | Pairs with **FS-01** (`vhostHTTPSPort`) — neither is useful alone |
| PT-02 | `xtcp` proxy form | gap | 3 | 4 | P2 | ditto | Only half-useful until **VIS-01** |
| PT-05 | Offer `stcp` in the Create Tunnel dialog | gap | 1 | 3 | P2 | `www/components/proxy/mutate_proxy_config.tsx:76` | `supportedProxyTypes` is hardcoded to `['http','tcp','udp']`. `stcp` already has a working form and is offered in the client-edit dropdown — pure oversight |
| PT-03 | `sudp` proxy form | gap | 2 | 2 | P3 | ditto | See the shared-form note below |
| PT-04 | `tcpmux` proxy form (incl. `multiplexer`, `routeByHTTPUser`) | gap | 3 | 2 | P3 | ditto | Pairs with **FS-07** |
| PT-06 | Address resolution for stcp/xtcp/sudp/tcpmux in the visit preview | gap | 2 | 2 | P3 | `www/components/base/visit-preview.tsx:56-69` | Display-only follow-on; currently resolves tcp/udp/http/https only |

> **Shared-form note.** `stcp`, `sudp`, and `xtcp` all take `secretKey` + `allowUsers` + a local
> address. One parametrized `SecretProxyForm`, generalized from the existing `STCPProxyForm`
> (`proxy_form.tsx:239`), covers all three. The D scores for PT-02/PT-03 assume that refactor;
> building them independently is D3 each.

---

## 2. Per-proxy fields

All of these are already declared in `www/types/proxy.ts`. **None is reachable from any form.**
Touch points for every row: `www/components/frpc/proxy_form.tsx` (zod schema + JSX) and
`www/i18n/locales/*.json`.

| ID | Feature | St | D | V | P | Notes |
|---|---|---|---|---|---|---|
| **PF-01** | `transport.useEncryption` | gap | 1 | 4 | **P1** | Security-relevant and it is one switch. Best value-per-effort row in the document |
| PF-05 | `healthCheck.{type,timeoutSeconds,maxFailed,intervalSeconds,path}` | gap | 2 | 4 | P2 | One accordion group |
| PF-02 | `transport.useCompression` | gap | 1 | 3 | P2 | |
| PF-04 | `transport.proxyProtocolVersion` | gap | 1 | 3 | P2 | Select: v1 / v2 |
| PF-06 | `loadBalancer.group`, `loadBalancer.groupKey` | gap | 1 | 3 | P2 | ⚠ The panel already writes these programmatically for Worker ingress (`biz/master/worker/create_worker_ingress.go:77-80`, `biz/master/proxy/update_proxy_config.go:80-82`). A UI must not let users collide with panel-managed groups |
| PF-09 | `hostHeaderRewrite` (http) | gap | 1 | 3 | P2 | |
| PF-12 | `allowUsers` (stcp/xtcp/sudp) | gap | 1 | 3 | P2 | Reachable for `stcp` today; blocked on PT-02/PT-03 for the other two |
| PF-03 | `transport.bandwidthLimit`, `transport.bandwidthLimitMode` | gap | 2 | 3 | P2 | frp's `BandwidthQuantity` is a string (`"1MB"`) — needs a unit-aware input, not a number field |
| PF-10 | `requestHeaders` (http) | gap | 2 | 3 | P2 | Needs the key/value editor from PF-07 |
| PF-11 | `routeByHTTPUser` (http, tcpmux) | gap | 1 | 2 | P3 | tcpmux half blocked on PT-04 |
| PF-07 | `metadatas` | gap | 2 | 2 | P3 | Build the reusable key/value map editor here; PF-08 and PF-10 reuse it |
| PF-08 | `annotations` | gap | 1 | 1 | P3 | ⚠ The panel stores its own keys here (`defs.FrpProxyAnnotationsKey_Ingress`, `_WorkerId` — `models/proxy_config.go:72-80`). A UI must preserve them |

---

## 3. Client plugins

frp v0.65.0 registers **10** client plugins (`pkg/plugin/client/*.go`). The picker has **7**
(`www/components/frpc/client_plugins.tsx:27-35`). **All three missing plugins already exist in
v0.65.0** — these are pure frp-panel gaps and need no version bump.

Present: `http_proxy`, `http2https`, `https2http`, `https2https`, `socks5`, `static_file`,
`unix_domain_socket`.

| ID | Feature | St | D | V | P | Notes |
|---|---|---|---|---|---|---|
| PLG-01 | `tls2raw` plugin form | gap | 2 | 3 | P2 | New `www/components/frpc/plugins/tls_2_raw_plugin_form.tsx` |
| PLG-02 | `http2http` plugin form | gap | 2 | 2 | P3 | Near-clone of `http_2_https_plugin_form.tsx` |
| PLG-04 | `requestHeaders` / `responseHeaders` on http2https, https2http, https2https | gap | 2 | 2 | P3 | Declared at `www/types/plugin.ts:24,38,47`; written by no form. `http_2_https_plugin_form.tsx:36` carries a placeholder comment marking where the `HeaderOperations` editor should go |
| PLG-05 | Wire up the `supportedPlugins` narrowing prop | gap | 1 | 2 | P3 | Declared at `client_plugins.tsx:40`, passed by no caller — so e.g. an `https` proxy is offered `static_file` |
| PLG-03 | `virtual_net` plugin form | gap | 3 | 2 | P3 | ⚠ **Alpha, gated off by default** in frp (`pkg/featuregate/feature_gate.go` — `VirtualNet: {Default: false, Stage: Alpha}`). A form alone does nothing; requires **FC-08** first |

---

## 4. frpc common config

The structured UI exposes **exactly one** frp field: `transport.protocol`
(`www/components/frpc/frpc_form.tsx:132-136`).

Rows here are **grouped by theme rather than one-per-field** — deliberately. Seventeen single-field
rows is the failure mode where nobody updates the document.

Touch points for every row: `www/components/frpc/frpc_form.tsx`, `www/types/client.ts`.

| ID | Feature group | St | D | V | P | Notes |
|---|---|---|---|---|---|---|
| FC-01 | `transport.tls.{enable,certFile,keyFile,trustedCaFile,serverName,disableCustomTLSFirstByte}` | gap | 2 | 4 | P2 | |
| FC-03 | `transport.proxyURL`, `transport.connectServerLocalIP` | gap | 1 | 3 | P2 | Corporate proxies and multi-homed hosts |
| FC-05 | `natHoleStunServer`, `dnsServer` | gap | 1 | 3 | P2 | A reachable STUN server is a prerequisite for usable xtcp — pairs with PT-02 |
| FC-02 | Connection tuning: `poolCount`, `tcpMux`, `tcpMuxKeepaliveInterval`, `heartbeatInterval`, `heartbeatTimeout`, `dialServerTimeout`, `dialServerKeepalive` | gap | 2 | 3 | P2 | Fix **BUG-05(a)** first — the TS type spells the last one wrong |
| FC-04 | `transport.quic.{keepalivePeriod,maxIdleTimeout,maxIncomingStreams}` | gap | 1 | 2 | P3 | |
| FC-06 | `auth.{method,token,oidc.*,additionalScopes}` | gap | 2 | 2 | P3 | ⚠ Confirmed **not** backend-overridden, so it is a genuine gap — but a dangerous one. frp-panel authenticates via the frps `multiuser` HTTP plugin plus `user` + `metadatas[token]`; setting `auth.method` will likely break login. Needs design, not a form field |
| FC-07 | `log.*`, `webServer.*` | gap | 2 | 2 | P3 | `webServer` on a panel-managed agent is largely redundant with the panel itself |
| FC-08 | `featureGates`, `virtualNet.address` | gap | 2 | 2 | P3 | **Absent from `www/types/client.ts` entirely**, so invisible to anyone auditing from the TS mirror. Unblocks PLG-03 |
| FC-09 | `loginFailExit`, `udpPacketSize`, `start[]` | gap | 1 | 1 | P3 | ⚠ `start[]` overlaps panel-managed proxy enablement (`utils/load.go:82-90`) and would fight **BUMP-01** |
| FC-10 | `includes[]` | won't-do | — | 1 | — | Resolves filesystem paths on the agent host. frp-panel's model is DB-sourced config pushed to the agent, so this is architecturally meaningless here |

---

## 5. frps config

The structured form exposes **8 fields** (`www/components/frps/frps_form.tsx:17-26`), one of which
(`publicHost`) is not an frp field at all — see §7.

frp fields present: `bindAddr`, `bindPort`, `proxyBindAddr`, `vhostHTTPPort`, `subDomainHost`,
`quicBindPort`, `kcpBindPort`.

| ID | Feature group | St | D | V | P | Notes |
|---|---|---|---|---|---|---|
| **FS-01** | `vhostHTTPSPort`, `vhostHTTPTimeout` | gap | 1 | 4 | **P1** | `https` is an advertised proxy type whose listener port cannot be set from the UI. Pairs with PT-01 |
| FS-02 | `allowPorts[]`, `maxPortsPerClient` | gap | 2 | 4 | P2 | Real multi-tenant safety need — arguably the strongest operator ask in this document |
| FS-05 | `sshTunnelGateway.{bindPort,privateKeyFile,autoGenPrivateKeyPath,authorizedKeysFile}` | gap | 1 | 3 | P2 | An entire frp feature that is currently invisible |
| FS-03 | `webServer.*`, `enablePrometheus` | gap | 2 | 3 | P2 | |
| FS-04 | `transport.{tcpMux,tcpMuxKeepaliveInterval,tcpKeepalive,maxPoolCount,heartbeatTimeout,quic.*,tls.force}` | gap | 2 | 3 | P2 | |
| FS-07 | `tcpmuxHTTPConnectPort`, `tcpmuxPassthrough` | gap | 1 | 2 | P3 | Pairs with PT-04 |
| FS-08 | `log.*`, `detailedErrorsToClient` | gap | 1 | 2 | P3 | |
| FS-06 | `auth.{method,token,oidc.*,additionalScopes}` | gap | 2 | 2 | P3 | ⚠ Same `multiuser`-plugin interaction hazard as FC-06 |
| FS-11 | `httpPlugins[]` — user-added entries | partial | 2 | 2 | P3 | ⚠ **Partly reserved.** `biz/master/server/update_tunnel.go:45-48` strips and re-appends the panel's own `multiuser` entry (`conf/helper.go:39-52`); any UI must preserve it. Fix **BUG-04** first |
| FS-09 | `custom404Page` | gap | 1 | 1 | P3 | |
| FS-10 | `userConnTimeout`, `udpPacketSize`, `natholeAnalysisDataReserveHours` | gap | 1 | 1 | P3 | |

---

## 6. Visitors

**There is no visitor UI at all.** `www/types/visitor.ts` exists and is imported by **zero**
components. Meanwhile the Go runtime supports visitors fully — `utils/load.go:32,57-100`,
`services/client/frpc_service.go:103-148` (`AddVisitor` / `RemoveVisitor` / `GetVisitorCfgs`).

Without visitors, `stcp` / `xtcp` / `sudp` proxies are half a feature: you can publish an endpoint
but nothing in the UI can connect to it.

| ID | Feature | St | D | V | P | Notes |
|---|---|---|---|---|---|---|
| VIS-01 | Visitor CRUD UI (list / create / edit / delete) | gap | 4 | 5 | P2 | **Blocked on BUG-01** — shipping this on top of the lossy serializer bakes data loss into a new feature |
| VIS-03 | Visitor↔proxy pairing helper: pick an stcp/xtcp/sudp proxy, auto-fill `serverName` + `secretKey` | gap | 2 | 4 | P2 | The actual UX win. Listed separately so it does not get lost inside VIS-01 |
| VIS-02 | xtcp visitor fields: `protocol`, `keepTunnelOpen`, `maxRetriesAnHour`, `minRetryInterval`, `fallbackTo`, `fallbackTimeoutMs` | gap | 2 | 3 | P2 | Depends on BUG-01 + VIS-01 |

---

## 7. Reserved / not-a-gap — do not "fix" these

Listed so nobody helpfully adds a field the backend will overwrite on the next save.

| Field | Why | Enforced at |
|---|---|---|
| frpc `serverAddr`, `serverPort` | Derived from the selected server, or from the frps URL. `serverPort` is chosen by protocol: kcp→`KCPBindPort`, quic→`QUICBindPort`, else `BindPort` | `biz/master/client/update_tunnel.go:98-106,137-138` |
| frpc `user` | Set to the panel account name. Also a security boundary — it namespaces proxy names across tenants on the wire and drives `allowUsers` | `biz/master/client/update_tunnel.go:143` |
| frpc `metadatas["token"]`, `metadatas["x-vaala-frp-client-id"]` | Panel auth + client identity | `biz/master/client/update_tunnel.go:149-150`, `defs/const.go:20,23` |
| frpc `transport.protocol` | **Exposed but mediated** — a third category. Users *can* set it (`frpc_form.tsx:132-136`), but the backend derives `serverPort` from it and the frps-URL path overwrites it from the URL scheme. Do not add a `serverPort` field alongside it | `biz/master/client/update_tunnel.go:98-150` |
| frps `httpPlugins[]` entry named `multiuser` | The panel's own auth plugin — frps calls back into `/auth` to authenticate every tunnel | `conf/helper.go:39-52`, `biz/master/server/update_tunnel.go:45-48`, `biz/server/rpc_pull_config.go:69` |
| frps form `publicHost` | **Not an frp field and not a defect.** A panel-level value, stripped before submit and sent as the `server_ip` request param (`idl/api_server.proto:50`). Do not move it into the config blob | `www/components/frps/frps_form.tsx` |
| frpc `includes[]` | See FC-10 | — |

> **`metadatas` as a whole is *not* reserved.** `update_tunnel.go:145-150` *merges* the two panel keys
> rather than replacing the map, so user-authored keys survive. Only those two keys are reserved —
> which is why PF-07 is a legitimate gap.

---

## 8. Blocked on frp upgrade

frp-panel pins `github.com/fatedier/frp v0.65.0` (`go.mod:15`); upstream frp is at **v0.70.1**.
These rows are parked until **BUMP-00** lands. D/V are still scored so the work can be sized.

| ID | frp | Feature | D | V | Notes |
|---|---|---|---|---|---|
| **BUMP-00** | — | **Upgrade frp v0.65.0 → v0.70.1** | 3 | 4 | **The enabling item.** Requires `go 1.25.0` (frp has needed it since v0.68.1), so there is no cheap intermediate target. frp v0.68 also moved proxy-name user-prefixing from config completion to the wire layer, which breaks the panel's proxy-status lookup |
| BUMP-01 | 0.66 | Per-proxy / per-visitor `enabled` flag (`*bool`; nil = enabled) | 1 | 4 | Highest-value post-bump row. Maps cleanly onto the panel's existing `Stopped` column and would supersede the `start[]` mechanism (see FC-09). No data migration needed — existing configs decode to nil and stay enabled |
| BUMP-08 | 0.70 | frps dashboard API v2: paginated clients/proxies, **proxy traffic history**, server system info, offline-proxy pruning | 3 | 4 | Traffic history could augment or replace the panel's own stats rollup |
| BUMP-10 | 0.70 | frpc rejects duplicate proxy/visitor names instead of silently overwriting | 1 | 3 | The panel should pre-validate rather than let the agent fail at load |
| BUMP-07 | 0.69 | `transport.wireProtocol` v1/v2 (AEAD-encrypted control channel; default stays v1) | 2 | 3 | ⚠ **Compat hazard.** A v2 frpc **cannot connect to an older frps**. This is a *validation* feature — the panel must refuse v2 on a client whose server is older — not merely a new field |
| BUMP-04 | 0.67 | Native frpc `clientID`; retire `metadatas["x-vaala-frp-client-id"]` | 3 | 3 | ⚠ A migration, not an addition: both schemes must coexist across an agent rollout. Harder than it looks |
| BUMP-02 | 0.66 | `loadBalancer` groups for `https` proxies | 1 | 2 | Extends PF-06 once PT-01 exists |
| BUMP-06 | 0.68 | `noweb` build tag → smaller client binaries | 2 | 2 | Relevant to `cmd/frppc` |
| BUMP-09 | 0.70 | WebSocket/WSS payloads sent as binary frames | 1 | 2 | Fixes disconnects through RFC-compliant intermediaries that validate text frames as UTF-8 |
| BUMP-05 | 0.68 | frpc `[store]` persisted config source + Store CRUD admin APIs | 5 | 2 | **Evaluate, do not build.** A competing model to the panel's push architecture — a persisted store would resurrect proxies the master deleted. Decide explicitly whether to adopt or reject |
| BUMP-03 | 0.66 | OIDC `tokenSource` (file / exec) | 1 | 1 | Only matters if FC-06 / FS-06 ever ship |

> frp v0.69.0 also established a formal **compatibility policy**: each minor is supported until nine
> newer minors exist, and you should **upgrade frps before frpc**. v0.69's `/api/clients` reports each
> client's negotiated wire protocol, which would let the panel surface a version-skew warning.

---

## Appendix: maintaining this file

**This file is hand-maintained. There is deliberately no generator.**

The question a generator would have to answer is *"is this field exposed in the UI?"*, and that is
not mechanically derivable here — fields reach forms through zod schema keys, JSX `name=` props,
object spreads, and the raw editor. Any heuristic would report §2's rows as closed, which is exactly
the bug class this document exists to record. A generator would also regenerate three of eight
columns while clobbering the five that carry actual judgment.

**One thing is worth automating.** A small `hack/frpdrift/main.go` (~60 lines, `reflect` only, no new
dependencies) can reflect over `v1.ClientCommonConfig`, `v1.ServerConfig`, every proxy and visitor
config type, and the client-plugin registry, emit the flat set of JSON field paths, and diff it
against the field names mentioned anywhere in this file. It answers exactly one question:

> *Has frp gained a field this matrix has never heard of?*

Zero false positives, and it catches the one thing that silently rots — a version bump quietly adding
surface area. (It is what would have caught `featureGates` and `virtualNet` being absent from both
`www/types/client.ts` and every previous audit.) Run it on demand: `go run ./hack/frpdrift`. It is
deliberately **not** wired into CI, because that would mean editing a shared workflow file.

**Conventions**

1. A PR that closes a row **deletes that row in the same PR** — or flips `St` to `done` with the PR
   number. One line, enforced at review.
2. Refresh the header stamp (`frp-panel @ <commit> · frp vX.Y.Z · reviewed <date>`) on every edit. A
   stale stamp is an honest signal that the file is stale.
3. **Cap this file at ~80 rows.** If it grows past that, split §8 into its own file. Grouping the
   frpc/frps sections by theme rather than by field is the main thing keeping the count down — resist
   expanding FC-02 into seven rows.
4. Scores are defaults, not mandates. Override a bucket when you have a reason, and write the reason
   in Notes.

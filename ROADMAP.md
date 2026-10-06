# Roadmap

> **frp-panel fork (`felix-homelab/frp-panel`) · frp v0.70.1 · go 1.25.0 · updated 2026-10-05**

This file tracks **order and progress**. [`FEATURE-MATRIX.md`](FEATURE-MATRIX.md) stays the source of
truth for **what** each frp-related row is and **why** it is scored the way it is — read the row there
before starting one here. IDs are shared between the two files; rows that exist only here (bugs found
while working the backlog, tooling, release work) are marked *new*. User-facing changes go into
[`CHANGELOG.md`](CHANGELOG.md) under `[Unreleased]` in the same change.

**Status:** `todo` · `wip` · `done` · `blocked` (waiting on a decision, named in the row) · `dropped`
(with the reason).

**Done means** (from the HU definition of done): builds cleanly with no new warnings, existing tests
pass, the change has tests that cover failure paths and not just the happy path, and anything that
could not be verified is written down here.

---

## M1 — Correctness (P0)

| ID | Item | St | Verification |
|---|---|---|---|
| BUG-08 | `UpdateWorkerLoadBalancerGroup` round-tripped the http proxy through `msg.NewProxy` and dropped `enabled`, `localIP`, `localPort`, `plugin`, `healthCheck.*`, `transport.proxyProtocolVersion` | **done** — mutates the `*HTTPProxyConfig` in place; the now-unused `frpx.NewProxyMsg` is deleted | `biz/master/proxy/update_proxy_config_test.go` (fails on the old code) |
| BUG-12 *new* | `enabled: false` was honoured only when the frpc service is **created**; every later update went through `Service.UpdateAllConfigurer`, which does not run frp's `FilterClientConfigurers` (frp `client/service.go:183` vs `:368`) | **done** — `frpx.UpdateClientConfigurers` applies frp's filter on every hot update; the master reports `disabled` instead of `error` for such a proxy | `TestTunnelMatrix/enabled=false_on_hot_update` (fails without the fix: proxy still up after 30s) + `TestLocalProxyStatus` |
| BUG-13 *new* | The "Add" buttons in `www/components/base/list-input.tsx` had no `type`, so they were submit buttons; in the frpc form, adding a metadata key **pushed the whole client config to the agent** | **done** — `type="button"` on all three | lint + type-check only — DOM behaviour, no DOM test environment |
| BUG-14 *new* | `RebuildProxyConfigFromClient` looked the old row up by `OriginClientID == child client id`, which never matches: every rebuild re-created every row under a new ID, and a stopped row was duplicated when its proxy reappeared in the client config | **done** — looks up by `ClientID`; existing duplicates collapse on the next rebuild, so no data migration | `services/dao/proxy_test.go` on sqlite (2 of 5 fail on the old code) |
| BUG-09 | frp `enabled` and panel `ProxyConfig.Stopped` are independent and disagree. Editing a stopped proxy also resurrects it (`create_proxy_config.go` never reads `Stopped`) | **blocked** — needs a decision on which flag is authoritative, see [Decisions](#decisions-needed) | — |

## M2 — UI gaps

| ID | Item | St | Verification |
|---|---|---|---|
| PLG-05 | Offer each proxy type only plugins that can work on it | **done** — `proxy_forms/shared/plugins.ts`; a stored unsupported plugin stays selectable | `www/test/proxy-plugins.test.mjs` |
| PLG-04 | **Scope corrected.** frp v0.70.1 plugins have `requestHeaders` but **no `responseHeaders`**. Real scope: `requestHeaders.set` on the four http(s)2http(s) plugins, plus `enableHTTP2` on the two https ones (also missing from the TS mirror) | **done** — `plugins/shared_fields.tsx`, i18n in all 4 locales | lint + type-check; a `hack/frpdrift` test pins "no `responseHeaders` on plugins" |
| FS-11 | frps `httpPlugins[]` user entries; the panel's `multiuser` entry stays read-only | **done** — `frps/form/http_plugins.tsx`; the two backend copies of strip-and-append are one helper, `conf.WithFRPsAuthPlugin` | `conf/frps_auth_plugin_test.go` + `www/test/frps-http-plugins.test.mjs` |

## M3 — Version-gated migrations

| ID | Item | St | Verification |
|---|---|---|---|
| CAP-01 *new* | Agents report their frp version (`ClientVersion.FrpVersion`, `frpx.Version()`); one version gate in `internal/frpx/version.go`. Agents that don't report it count as too old | **done** — proto regenerated with the pinned toolchain (protoc 3.21.11, protoc-gen-go 1.36.8, protoc-gen-go-grpc 1.5.1, protobuf-ts 2.9.3); unchanged files came out byte-identical | `internal/frpx/version_test.go` |
| BUMP-07 | Finish `transport.wireProtocol: v2` | **done** — the form offers v2 only when both agents report frp ≥ v0.69; `biz/master/client/wire_protocol.go` re-checks on every save, outside the frpsUrl branch, and always refuses an external frps. **Trade-off:** a client set to v2 can only be saved while both agents are online | `wire_protocol_test.go` (no ping unless v2) + `www/test/wire-protocol.test.mjs` |
| BUMP-04 | Native frpc `clientID`; retire `metadatas["x-vaala-frp-client-id"]` | **blocked** — **recommend won't-do**: with `clientID`, frps refuses a login from a new run ID while the old session is registered, and frpc's `loginFailExit` defaults to `true`, so an agent restart can take every tunnel down. The metadata key is now useful to FS-11 user plugins. See [Decisions](#decisions-needed) | — |

## M4 — Features

| ID | Item | St | Verification |
|---|---|---|---|
| FS-12 | Panel-managed shared frp auth token: one token on the `Server` record, injected into the frps blob and every child frpc blob in one transaction | todo — **design first**: a new `Server` column (AutoMigrate), and a rollout order across agents. frps restarts on any config change, so some reconnect window exists either way; the design has to bound it | — |
| UI-01 *new, from `notes.md`* | A settings editor in the web UI for panel/agent settings — e.g. the install location. Today these are env-only (`conf/settings.go`, ~39 settings) | todo — scope it first: which settings are safe to change at runtime, and where an agent-side setting would live | — |

## M5 — Tooling, CI, docs

| ID | Item | St | Verification |
|---|---|---|---|
| TOOL-01 | `hack/frpdrift`: frp config field paths vs a reviewed baseline (`known.txt`, 428 paths at v0.70.1) | **done** | `hack/frpdrift/walk_test.go`; drift check exits 1 on a stale baseline |
| TOOL-02 *new* | `fork-checks.yml` had no frontend job although the matrix said it did; `biz/`, `services/dao` and `hack/` tests were not run | **done** — frontend job (`pnpm test`, `pnpm lint`, `next build`), Go test list extended | **not run on GitHub yet** — the same commands pass locally (frontend tests also on Node 20 in Docker) |
| TOOL-03 *new* | No frontend test runner | **done** — `pnpm test`: Node's built-in runner + `www/test/ts-hooks.mjs`, which reuses the project's TypeScript. No new dependency. Pure modules only (no DOM) | 17 tests on Node 24 and Node 20 |
| DOC-01 *new* | Matrix and runbook corrections | **done** — closed rows moved to "Closed" notes, PLG-04 scope, stale line refs, Verification section, runbook §3 (it still said four types and visitors had no UI) | — |
| DOC-02 *new* | `CHANGELOG.md` per tag, with the difference to upstream; README "About this fork" (+ a short note in `README_zh.md`) | **done** — `release.yml` now publishes the tag's CHANGELOG section as release notes and **refuses to release a tag without one** (`.github/scripts/changelog-section.sh`) | script tested locally (present / missing / empty section); workflow not run yet |

## M6 — Release and distribution *new*

Found while writing the changelog. Verified in code; the GitHub-side facts come from the public API.

| ID | Item | St | Verification |
|---|---|---|---|
| REL-01 | **Everything that downloads frp-panel still points at upstream**: `install.sh:63-86`, `install.ps1:6`, the join commands the UI generates (`www/lib/consts.ts:316,329`, which fetch upstream's `install.sh` from `raw.githubusercontent.com/VaalaCat/...`), the OTA self-upgrade (`biz/common/upgrade/download_url.go:21`) and three UI download links. An in-app upgrade of a fork agent therefore installs **upstream's** build — frp v0.65, without this fork's fixes | **blocked** — see [Decisions](#decisions-needed). Your note "install scripts hosted on the same endpoint as frp web panel" (`notes.md`) is the clean fix for the install-script half | — |
| REL-02 | The fork has **no `latest` tag or release**, although the "Refresh rolling `latest` release" step reported success on v0.10.1. `install.sh` downloads `releases/download/latest/…`, so pointing it at the fork today would 404 | todo — investigate the workflow run before REL-01 lands | — |
| REL-04 *new* | The fork published no container images: upstream's ko steps need Docker Hub secrets and push to `docker.io/vaalacat/frp-panel` | **done** — `release.yml` builds them like upstream (ko, `.ko.yaml` / `.ko.workerd.yaml`) and pushes `ghcr.io/felix-homelab/frp-panel:{<tag>,latest,<tag>-workerd,latest-workerd}` with the job's own token. **Check after the first release:** that the GHCR package is public; new packages can start out private | local `ko build --push=false` for all alpine platforms and the workerd variant; the amd64 image ran `version` (frp 0.70.1) with the source label set; `actionlint` + shellcheck clean. The real push is **not run yet** |
| REL-03 | Upstream's tag workflows (`Master Release`, `Version Tag Release`, workerd docker, VitePress) still run on this fork and fail, contradicting the comment in `release.yml` that they are disabled | todo — disable them repo-side (Actions → Workflows → Disable); a repo setting, nothing to commit | — |

---

## Decisions needed

1. **BUG-09 — which flag is authoritative?**
   - **A. `Stopped` is authoritative** *(recommended)*. It works on every agent version, because a
     stopped proxy is removed from the config rather than relying on the agent to skip it. The form's
     `enabled` switch goes away (frp's field stays reachable through the raw editor, and since BUG-12
     it now works and shows as `disabled`). Editing a stopped proxy keeps it stopped.
   - **B. `enabled` is authoritative**, and `Stopped` is derived from it. This is closer to frp, but it
     needs a data migration of every stopped row, and agents older than frp v0.66 reject the key.
   - **C. Keep both and sync them on every write path.** This adds more places that can drift.
2. **BUMP-04 — accept won't-do?** Recommended. The reasons are recorded in `FEATURE-MATRIX.md` §8.
3. **REL-01 — where should fork installs and upgrades come from?** Recommended: `felix-homelab/frp-panel`
   for the OTA upgrade and download links, and the master serving its own `install.sh` / `install.ps1`
   (your note) for the join commands. This needs REL-02 fixed first.
4. **What next: FS-12 or UI-01?** Both need a short design pass before code.

## Progress log

- **2026-10-05** — Roadmap created. Baseline was green (build, vet, unit tests, `TestTunnelMatrix`,
  `pnpm lint` with 11 pre-existing `react-hooks/exhaustive-deps` warnings, `next build`). Closed:
  BUG-08, BUG-12, BUG-13, BUG-14, PLG-04, PLG-05, FS-11, CAP-01, BUMP-07, TOOL-01–03, DOC-01, DOC-02.
  Found and recorded: BUG-12–14, REL-01–03, the PLG-04 scope error, the BUMP-04 hazard. Final state:
  every Go package in the CI list passes, as do the tunnel matrix and 17 frontend tests; lint has no
  new findings and the build has no new warnings. Nothing is committed yet: the work is on branch
  `improvement/backlog-roadmap`, uncommitted.

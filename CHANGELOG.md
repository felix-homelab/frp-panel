# Changelog

All notable changes to **this fork** ([felix-homelab/frp-panel](https://github.com/felix-homelab/frp-panel))
of [VaalaCat/frp-panel](https://github.com/VaalaCat/frp-panel). One section per release tag; the
release workflow publishes the section that matches the tag as the GitHub release notes, and refuses
to release a tag that has no section here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Item IDs (`BUG-12`, `FS-11`, …)
refer to [`FEATURE-MATRIX.md`](FEATURE-MATRIX.md) and [`ROADMAP.md`](ROADMAP.md).

## How this fork relates to upstream

- **Forked from** upstream **v0.1.37** (commit `1a58b85`, 2026-04-19, "feat: add ephemeral flag"),
  which was also upstream's latest commit when the fork started. Everything up to and including
  v0.1.37 is upstream's work — see [upstream's releases](https://github.com/VaalaCat/frp-panel/releases).
- **Version numbers are the fork's own.** `v0.10.x` is not an upstream version and does not mean
  "upstream 0.1 + 9". Upstream continues its own `v0.1.x` line.
- **Cumulative differences** to upstream v0.1.37, as of the newest entry below:
  - frp **v0.70.1** instead of v0.65.0, built with Go **1.25** instead of 1.24.
  - A form for **every** frp proxy type (upstream: tcp, stcp, udp, http), for visitors (upstream: none),
    for all nine client plugins (upstream: seven), and full frpc / frps settings forms, so nearly
    everything that upstream only reaches through the raw JSON editor has a form.
  - Many fixes for config that was silently lost or rejected — listed per release below.
  - Releases are built by the fork's own `release.yml`. Container images go to
    `ghcr.io/felix-homelab/frp-panel` instead of upstream's `docker.io/vaalacat/frp-panel`, starting
    with the first release after v0.10.1; v0.10.0 and v0.10.1 have binaries only.
  - **Not yet changed:** `install.sh`, `install.ps1`, the in-app upgrade and the "download" links in the
    UI still fetch **upstream's** binaries (ROADMAP `REL-01`). Install this fork's binaries from its
    [releases page](https://github.com/felix-homelab/frp-panel/releases) instead.

## [Unreleased]

## [v0.10.2] - 2026-10-06

Upgrade order is unchanged: Servers, then the Master, then Clients. The fixes marked *agent* only take
effect on agents running this version.

### Added
- **Your own frps HTTP plugins** (`FS-11`). The server form has an "HTTP plugins" section for adding
  frp server plugins — name, address, path, operations, TLS verification. The panel's own
  authentication plugin is shown read-only and is always kept last; a user plugin cannot take its name.
- **Request headers and HTTP/2 on client plugins** (`PLG-04`). `http2http`, `http2https`, `https2http`
  and `https2https` can set request headers; `https2http` and `https2https` can switch HTTP/2 off.
- **wireProtocol v2 can be selected** (`BUMP-07`) — but only when both the client's agent and the
  server's agent run frp v0.69 or newer, and not for clients that use an external frps URL. The Master
  re-checks this on every save, so a v2 config can no longer reach an agent that cannot speak it.
- Agents now report the frp version they are built with (`CAP-01`); it is also printed by `version`.
- **Docker images** (`REL-04`). Each release publishes `ghcr.io/felix-homelab/frp-panel:<tag>` and
  `:latest` for every platform Alpine supports (amd64, arm64, arm/v6, arm/v7, 386, ppc64le, riscv64,
  s390x), plus `:<tag>-workerd` and `:latest-workerd` (amd64, arm64) for agents that run Workers.
  They are built like upstream's images, so upstream's Docker instructions apply with the image name
  swapped.

### Changed
- **Proxy forms offer only plugins that work for the proxy type** (`PLG-05`): for example no
  `static_file` on `https`, and no plugins at all on `udp` / `sudp`, which frp ignores. A plugin that
  is already configured stays visible.
- A proxy switched off with **Enabled** now shows as `disabled` in the proxy list instead of `error`.
- The Master rejects a `transport.wireProtocol` other than `v1` or `v2` before it reaches an agent.
- **With wireProtocol v2 set, saving that client needs both agents online**, because an offline agent
  cannot confirm its frp version.

### Fixed
- *agent* — **Switching a proxy off had no effect until the agent restarted** (`BUG-12`). frp only
  honours `enabled: false` when a client starts; every later update now applies it too.
- **Clicking "Add" in a list or key/value field submitted the whole form** (`BUG-13`). In the client
  form this pushed the client's configuration to the agent on every added metadata key.
- **Proxies were re-created with new IDs on every client save, and a stopped proxy could appear twice**
  (`BUG-14`). Existing duplicates are cleaned up automatically the next time that client is saved.
- **Updating an http proxy through the API dropped six of its settings** (`BUG-08`): `enabled`, local
  IP and port, plugin, health check and PROXY protocol version. Not reachable from the UI.

### Developer
- Fork CI (`fork-checks.yml`) now also runs the `biz` and `services/dao` tests and a frontend job
  (`pnpm test`, `pnpm lint`, `next build`).
- `pnpm test` in `www/` runs frontend unit tests with Node's built-in test runner — no new dependency.
- New [`ROADMAP.md`](ROADMAP.md) tracks the backlog's order and progress.
- `go run ./hack/frpdrift` lists frp config fields added or removed since the last review.
- Release notes for each tag now come from this file, and a tag without a section here is not released.

## [v0.10.1] - 2026-08-11

The first release of this fork with downloadable binaries.

### Added
- **Forms for every proxy type.** https, tcpmux, xtcp and sudp join tcp, udp, http and stcp, each with
  collapsible sections for transport (encryption, compression, bandwidth limit, PROXY protocol),
  health checks, load balancing, header rewriting, metadata, annotations and allowed users.
- **Visitors** can be created and edited from the client card, including xtcp tuning and a helper that
  pairs a visitor with an existing stcp / xtcp / sudp proxy.
- **Client (frpc) settings form**: TLS, connection tuning, proxy URL, QUIC, STUN / DNS server, logging,
  the agent web server, login-failure behaviour, UDP packet size and metadata.
- **Server (frps) settings form**: HTTPS virtual-host port and HTTP timeout, allowed ports and per-client
  port limits, dashboard and Prometheus, transport and TLS, SSH tunnel gateway, tcpmux, logging and a
  custom 404 page.
- The fork's own release workflow (`.github/workflows/release.yml`).

### Changed
- Configurations with **duplicate proxy or visitor names are rejected** instead of one silently
  replacing the other (`BUG-10`).
- **Server configurations are validated before they are saved** (`BUG-11`).

### Fixed
- xtcp visitor settings were dropped whenever a proxy of that client was edited (`BUG-01`).
- Creating a proxy from raw JSON was refused (`BUG-02`).
- Proxy types without a form showed an empty panel (`BUG-03`).
- Duplicate frps HTTP plugin entries were not removed (`BUG-04`).
- Client TLS settings were saved in a shape frp could not load (`BUG-05`).
- Saving the client or server form deleted every setting the form does not show — visitors, logging,
  web server and more (`BUG-06`, `BUG-07`).
- An invalid server configuration (for example a bad log level) crashed the Server agent (`BUG-11`).

## [v0.10.0] - 2026-08-11

> The GitHub release for this tag has **no binaries**: it was built by upstream's workflow, which
> failed on this fork. Use v0.10.1 or later.

### Changed
- **frp v0.65.0 → v0.70.1**, golib v0.5.1 → v0.8.1, **Go 1.24 → 1.25**.
- Proxy status keeps working across frp v0.68's change to how proxy names are stored, so mixed
  old/new agents do not show every proxy as `error` during an upgrade.
- frp's new client-side proxy store stays disabled on purpose: it would bring back proxies that were
  deleted in the panel.

### Added
- Plugin forms for **http2http** and **tls2raw**.
- An **Enabled** switch on every proxy form.

### Developer
- All frp imports live behind `internal/frpx`, so an frp upgrade touches one package.
- A live tunnel test (`go test -tags integration ./internal/frpx/...`) that runs a real frps and frpc
  and sends traffic through every proxy type; the fork's CI workflow (`fork-checks.yml`); and an frp
  upgrade runbook (`docs/frp-upgrade-verification.md`).
- [`FEATURE-MATRIX.md`](FEATURE-MATRIX.md): the backlog of frp features the UI does not cover yet.

[Unreleased]: https://github.com/felix-homelab/frp-panel/compare/v0.10.1...HEAD
[v0.10.1]: https://github.com/felix-homelab/frp-panel/compare/v0.10.0...v0.10.1
[v0.10.0]: https://github.com/felix-homelab/frp-panel/compare/1a58b85...v0.10.0

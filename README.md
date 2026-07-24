<!-- prettier-ignore -->
<div align="center">

<img src="docs/assets/logo.svg" alt="Pi Desktop" height="80" />

<h1>Pi Desktop</h1>
<p><strong>Alpha</strong></p>

<p>A native macOS desktop for the <a href="https://github.com/mariozechner/pi-coding-agent">Pi</a> coding agent—repos, worktrees, terminals, and chat in one place.</p>

<p>
  <a href="https://www.electronjs.org"><img src="https://img.shields.io/badge/Electron-41-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron"></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://github.com/tanRdev/pi-desktop/releases"><img src="https://img.shields.io/github/v/release/tanRdev/pi-desktop?style=flat-square" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" alt="Status"></a>
</p>

<p><a href="#install">Install</a> · <a href="#quick-start">Quick start</a> · <a href="#features">Features</a> · <a href="#architecture">Architecture</a> · <a href="#development">Development</a> · <a href="#contributing">Contributing</a></p>

</div>

> [!CAUTION]
> **Alpha.** Expect breaking changes and rough edges. Without the `pi` CLI installed, chat uses the built-in **mock** agent so the shell stays usable out of the box. Install `pi` (or set `PI_CLI_PATH`) for real CLI/SDK chat.

> [!TIP]
> Grab the latest arm64 DMG from [Releases](https://github.com/tanRdev/pi-desktop/releases), open it, and drag **Pi Desktop** into Applications.

## Install

**macOS (recommended)** — download `Pi Desktop-<version>-arm64.dmg` from [GitHub Releases](https://github.com/tanRdev/pi-desktop/releases).

**From source**

```bash
git clone https://github.com/tanRdev/pi-desktop.git
cd pi-desktop
bun install
bun run build
bun run --filter @pi-desktop/desktop dist:mac   # optional packaged build
```

**Requirements:** macOS 11+, Bun 1.3+, Node.js 24.13.1+. After Electron upgrades, run `bun install` so native modules (e.g. `node-pty`) rebuild.

## Quick start

```bash
bun install
bun run build
bun run dev
```

That opens Pi Desktop with hot reload. Add a local git repository, create a worktree, and send a chat message—the mock agent answers when `pi` isn’t installed.

## Features

| Feature | Status | Notes |
|---------|--------|-------|
| Repositories | Alpha | Browse and organize local projects |
| Worktrees | Alpha | Create / switch / remove isolated checkouts |
| Terminal | Alpha | Integrated `node-pty` terminal |
| Agent chat | Alpha | Mock by default without `pi`; CLI/SDK when available; in-app OAuth |
| Packages | Alpha | Catalog browse / install—expect rough edges |
| Auto-updates | Alpha | Packaged updater with Settings consent |
| Security boundary | Solid | Main ↔ Contracts preload ↔ renderer |

## Architecture

Monorepo with a hard Electron security boundary:

```
pi-desktop/
├── apps/desktop/          # Electron main, preload, React renderer
└── packages/
    ├── contracts/         # IPC channels + Effect Schema (single source of truth)
    ├── shared/            # Domain models and shared utilities
    ├── agent-host/        # Mock / CLI / SDK agent runtimes
    ├── shell-model/       # Pure shell + agent-feed state
    └── ui/                # Geist tokens, glass shell, shared primitives
```

- **Main** owns catalogs (versioned JSON persistence), git, terminals, windows, and the agent-host process.
- **Preload** exposes a typed Contracts client via `contextBridge`—no Node in the renderer.
- **Renderer** is React 19 + Zustand + Tailwind; all native work goes through IPC.
- **Agent host** runs in an isolated session-server child; context switches cancel stale setups so only the latest thread wins.

## Development

| Command | Purpose |
|---------|---------|
| `bun install` | Install deps, hooks, native rebuild |
| `bun run dev` | Electron + hot reload |
| `bun run build` | Build all workspaces |
| `bun run lint` | Biome |
| `bun run typecheck` | Typecheck all workspaces |
| `bun run test` | Vitest (unit + integration) |
| `bun run test:e2e` | Playwright smoke (mock agent) |
| `bun run lint:contracts` | IPC Contract coverage gate |

```bash
# Packaged macOS build
bun run --filter @pi-desktop/desktop dist:mac
# → dist/release/Pi Desktop-<version>-arm64.{dmg,zip}
```

Pre-commit hooks live in `.githooks/` and are wired by `prepare` on install.

## Contributing

MIT-licensed. [Issues](https://github.com/tanRdev/pi-desktop/issues) and PRs welcome.

1. Fork and branch from `main`
2. Keep changes focused; add tests where they earn their keep
3. Run `bun run lint && bun run typecheck && bun run test` before opening a PR

## License

[MIT](LICENSE)

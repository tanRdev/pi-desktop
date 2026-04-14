<p align="center">
  <img src="docs/assets/logo.svg" alt="Pi Desktop logo" width="160" height="160">
</p>

# Pi Desktop

Pi Desktop is a macOS app for running the Pi coding agent in a native desktop shell. It wraps the agent in a hardened Electron app with repository, worktree, terminal, package, and chat workflows built for local development.

## What It Ships

- Native macOS desktop app with DMG distribution
- Electron main process with sandboxed preload bridge
- React 19 renderer for chat, repositories, worktrees, terminal, and package flows
- Local agent host runtime with mock, CLI, and Pi SDK modes
- Vitest integration coverage and Playwright end-to-end coverage

## Requirements

- macOS 11 or later
- Bun 1.3+
- Node.js 24.13.1 or later

## Install

### Release build

Download the latest DMG from GitHub Releases and drag `Pi Desktop.app` into `Applications`.

### From source

```bash
git clone https://github.com/tanRdev/PiDesk.git
cd pi-desktop
bun install
bun run build
```

## Development

### Run the app

```bash
openlogs bun run dev
```

### Common commands

| Command | Purpose |
| --- | --- |
| `bun install` | Install workspace dependencies |
| `bun run build` | Build all workspaces |
| `bun run lint` | Run Biome checks |
| `bun run format` | Apply Biome formatting |
| `bun run typecheck` | Run workspace typechecks |
| `bun run test` | Run Vitest integration tests |
| `bun run test:e2e` | Run Playwright end-to-end tests |

## Repository Layout

```text
pi-desktop/
├── apps/desktop       # Electron app
├── packages/shared    # Shared IPC contracts and models
├── packages/agent-host# Agent runtime implementations
├── packages/shell-model
└── packages/ui        # Shared UI primitives and styles
```

## Packaging

Production macOS artifacts are generated with Electron Builder.

```bash
bun run build
bunx electron-builder --config electron-builder.yml --mac dmg --arm64
```

Output is written to `dist/release/`.

## Quality Bar

Before shipping, run:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

## License

MIT

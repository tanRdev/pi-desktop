<!-- prettier-ignore -->
<div align="center">

<img src="docs/assets/logo.svg" alt="Pi Desktop" height="80" />

<h1>Pi Desktop</h1>

<p>Native macOS agentic coding harness for the Pi coding agent. <strong>Alpha.</strong></p>

<p>
  <a href="https://www.electronjs.org"><img src="https://img.shields.io/badge/Electron-41-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron"></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://github.com/tanRdev/pi-desktop/releases"><img src="https://img.shields.io/github/v/release/tanRdev/pi-desktop?style=flat-square" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" alt="Status"></a>
</p>

<p><a href="#overview">Overview</a> · <a href="#quick-start">Quick Start</a> · <a href="#installation">Installation</a> · <a href="#usage">Usage</a> · <a href="#architecture">Architecture</a> · <a href="#development">Development</a> · <a href="#contributing">Contributing</a></p>

<!-- Add screenshot here once available -->
<!-- <img src="docs/assets/screenshot.png" alt="Pi Desktop Screenshot" /> -->

</div>

> [!TIP]
> Download the latest DMG from [GitHub Releases](https://github.com/tanRdev/pi-desktop/releases) and drag **Pi Desktop.app** into your `Applications` folder.

## Overview

**Pi Desktop** is an agentic coding harness that wraps the Pi coding agent in a hardened macOS application. It provides a native interface for managing repositories, creating isolated Git worktrees, running terminals, handling packages, and chatting with the agent—all without leaving the desktop.

Built with Electron 41, React 19, and TypeScript 5.9, it runs the agent locally through multiple runtime modes (mock, CLI, Pi SDK) and ships as a signed DMG for macOS 11+.

## Quick Start

```bash
git clone https://github.com/tanRdev/pi-desktop.git
cd pi-desktop
bun install
bun run build
bun run dev
```

This launches Pi Desktop in development mode with hot reload.

## Installation

### macOS DMG (Recommended)

Download `Pi Desktop-0.1.0-arm64.dmg` from [GitHub Releases](https://github.com/tanRdev/pi-desktop/releases).

1. Open the DMG file.
2. Drag **Pi Desktop.app** into your `Applications` folder.
3. Launch from Applications or Spotlight.

### From Source

```bash
git clone https://github.com/tanRdev/pi-desktop.git
cd pi-desktop
bun install
bun run build
```

### Requirements

- macOS 11 or later
- Bun 1.3+
- Node.js 24.13.1+

> [!NOTE]
> The app requires Electron 41 and native dependencies (node-pty). Run `bun install` to rebuild native modules after upgrading Electron.

## Usage

1. Launch Pi Desktop from Applications.
2. Browse and manage local repositories.
3. Create isolated Git worktrees for parallel development.
4. Open integrated terminals in any project.
5. Chat with the Pi coding agent directly in the app.
6. View and manage project dependencies.

### Agent Runtime Modes

| Mode | Description |
|------|-------------|
| Mock | Simulated responses for UI development |
| CLI | Wraps the Pi agent CLI binary |
| Pi SDK | Direct integration with the Pi agent SDK |

## Features

| Feature | Description |
|---------|-------------|
| Repository Management | Browse, clone, and organize local repositories |
| Worktree Isolation | Create and switch between Git worktrees for parallel branches |
| Integrated Terminal | Full terminal emulator powered by node-pty |
| Package Management | View and manage project dependencies |
| Agent Chat | Interactive chat interface with the Pi coding agent |
| Sandboxed Architecture | Electron main process with secure preload bridge |
| Native macOS App | Signed DMG distribution, runs as a proper desktop application |

## Architecture

```
pi-desktop/
├── apps/desktop/         # Electron harness
│   ├── src/
│   │   ├── main/         # Main process (windows, IPC, native integrations)
│   │   ├── preload/      # Secure bridge between main and renderer
│   │   └── renderer/     # React 19 UI with Tailwind CSS and Radix UI
│   └── electron-builder.yml
├── packages/
│   ├── shared/           # IPC contracts, shared types, and models
│   ├── agent-host/       # Agent runtime implementations (mock, CLI, SDK)
│   ├── shell-model/
│   └── ui/               # Shared React components and styles
├── scripts/              # Build and release automation
├── tests/                # Playwright end-to-end tests
└── electron-builder.yml  # Electron Builder configuration
```

### How It Works

Pi Desktop uses a multi-process Electron architecture with strict separation between the main process and renderer:

1. **Main Process** (`apps/desktop/src/main/`) manages application windows, native menus, IPC handlers, and agent host sessions. It runs the agent runtime in a controlled environment.

2. **Preload Bridge** (`apps/desktop/src/preload/`) exposes a minimal, typed API to the renderer via Electron's context bridge. No Node.js APIs leak to the renderer.

3. **Renderer** (`apps/desktop/src/renderer/`) is a React 19 application with Tailwind CSS 4 and Radix UI primitives. It handles the chat interface, repository browser, worktree manager, terminal views, and package explorer.

4. **Agent Host** (`packages/agent-host/`) provides three runtime modes: mock (for UI development), CLI (wraps the Pi agent binary), and SDK (direct Pi agent integration). The desktop app selects the mode based on configuration.

5. **Shared Contracts** (`packages/shared/`) define IPC message types, database models, and type-safe interfaces consumed by both the main process and renderer.

> [!WARNING]
> The app bundles node-pty with native bindings. After upgrading Electron or Node.js, run `bun install` in `apps/desktop` to rebuild native modules, or use the `postinstall` script.

## Development

### Run locally

```bash
bun run dev
```

Starts the Electron app in development mode with hot reload for the renderer process.

### Commands

| Command | Purpose |
|---------|---------|
| `bun install` | Install workspace dependencies and rebuild native modules |
| `bun run build` | Build all workspaces (main, preload, renderer) |
| `bun run dev` | Start dev server with hot reload |
| `bun run lint` | Run Biome linter |
| `bun run format` | Apply Biome formatting |
| `bun run typecheck` | Type-check all workspaces |
| `bun run test` | Run Vitest unit tests |
| `bun run test:e2e` | Run Playwright end-to-end tests |

### Build macOS release

```bash
cd apps/desktop
bun run dist:mac
```

Output lands in `dist/release/` as:
- `Pi Desktop-0.1.0-arm64.dmg`
- `Pi Desktop-0.1.0-arm64.zip`

### Quality

Before shipping, run the full quality suite:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

## Contributing

Contributions are welcome. Pi Desktop is open source under the [MIT License](LICENSE).

### Ways to Contribute

- **Report bugs** — [Open an issue](https://github.com/tanRdev/pi-desktop/issues) with steps to reproduce
- **Suggest features** — Describe the problem you're solving before proposing solutions
- **Improve documentation** — Fix typos, clarify instructions, or add examples
- **Submit pull requests** — Fork the repo, branch off `main`, and open a PR with a clear description

### Development Setup

```bash
git clone https://github.com/tanRdev/pi-desktop.git
cd pi-desktop
bun install
bun run dev
```

### Code Standards

- Follow existing TypeScript and React conventions
- Use Biome for formatting and linting
- Add tests for new functionality
- Run `bun run typecheck` and `bun run lint` before opening a PR
- Keep commits focused and descriptive

## Resources

- [GitHub Releases](https://github.com/tanRdev/pi-desktop/releases)
- [Issue Tracker](https://github.com/tanRdev/pi-desktop/issues)

## License

Pi Desktop is licensed under the MIT License. See the [`LICENSE`](LICENSE) file for details.

## Getting Help

- [Open an issue](https://github.com/tanRdev/pi-desktop/issues)

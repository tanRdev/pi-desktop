<!-- prettier-ignore -->
<div align="center">

<img src="docs/assets/logo.svg" alt="Pi Desktop" height="80" />

<h1>Pi Desktop</h1>
<p><strong>Alpha</strong></p>

<p>Native macOS agentic coding harness for the Pi coding agent.</p>

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

> [!CAUTION]
> **Alpha software.** Expect breaking changes, incomplete features, and rough edges. Not ready for daily use.

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

### System Overview

Pi Desktop is built on Electron's multi-process architecture with a strict security boundary between the main process (Node.js) and the renderer process (Chromium). The codebase is organized as a monorepo with clear separation between application code and shared packages.

```
pi-desktop/
├── apps/desktop/         # Electron application
│   ├── src/main/         # Main process: windows, IPC, native integrations
│   ├── src/preload/      # Preload bridge: secure API exposure
│   └── src/renderer/     # Renderer: React 19 UI
├── packages/
│   ├── shared/           # IPC contracts, types, models
│   ├── agent-host/       # Agent runtime abstractions
│   ├── shell-model/      # State management logic
│   └── ui/               # Shared React components
└── tests/                # E2E tests
```

### Process Architecture

**Main Process** (`apps/desktop/src/main/`)
The main process is the authority for all native operations. It manages:
- Window lifecycle and native menus
- File system operations through catalog classes
- Git operations via `GitWorktreeService`
- Terminal management via `node-pty`
- Agent host sessions in isolated processes
- IPC handler registration and routing

The main process is written in TypeScript with the `effect` library, which provides typed, composable async operations with explicit error handling.

**Preload Bridge** (`apps/desktop/src/preload/`)
The preload script runs in an isolated context with access to both Node.js and the renderer's DOM. It exposes a minimal, typed API to the renderer through Electron's `contextBridge`. This prevents Node.js APIs from leaking into the renderer while enabling secure communication.

**Renderer Process** (`apps/desktop/src/renderer/`)
The renderer is a React 19 application built with:
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Radix UI** for accessible primitives

The renderer has no direct access to Node.js APIs; all native operations go through the preload bridge via typed IPC channels.

### Data Layer

**Catalog Pattern**
Domain entities are managed through catalog classes that provide:
- Atomic JSON file persistence via `PersistentJsonFile`
- Immutable state updates (returns new references, never mutates)
- Optimistic updates with rollback on failure
- Versioned schemas for backward compatibility

Key catalogs:
- `RepositoryCatalog`: Manages repository metadata
- `ThreadCatalog`: Manages chat threads and sessions
- `WorkspaceSessionCatalog`: Manages editor/workspace state

**State Flow**
```
User Action → Catalog.update() → PersistentJsonFile → Disk
                    ↓
              IPC Notification → Renderer Re-render
```

### Agent Runtime

The agent layer is abstracted to support multiple runtime modes without changing the desktop's calling code.

**Runtime Factory**
`createAgentRuntime()` instantiates the appropriate implementation:
- `MockAgentRuntime`: Returns canned responses for UI development
- `PiCliRpcAgentRuntime`: Spawns the Pi CLI and communicates via RPC
- `PiSdkAgentRuntime`: Direct SDK integration (in-process)

All implementations conform to the same interface, allowing runtime selection via environment variables.

**Session Lifecycle**
1. User selects a thread
2. `ContextSwitchController` initiates the switch
3. Previous session is torn down (unsubscribed, transport closed)
4. New agent process spawned (if needed)
5. Socket connection established
6. Event subscription begins
7. UI notified of state change

The controller uses versioned cancellation tokens to handle rapid context switches—if a user clicks three threads in quick succession, only the last one's setup completes.

### IPC Design

All communication between main and renderer uses typed channels defined in `@pi-desktop/shared`:

```typescript
// IPC_CHANNELS.agent.prompt
type PromptRequest = { text: string }
type PromptResponse = void

// IPC_CHANNELS.shell.getSnapshot
type SnapshotRequest = void
type SnapshotResponse = ShellSnapshot
```

Handlers are registered via `registerIpcHandlers()` and organized by domain (terminal, git, state, etc.). Errors are sanitized before crossing the boundary to prevent leaking internal details.

### Error Handling

The main process uses the `effect` library for structured error handling:

```typescript
Effect.tryPromise({
  try: () => gitService.createWorktree(options),
  catch: (error) => GitError.from(error)
}).pipe(
  Effect.tap(() => notifySessionChanged()),
  Effect.catchAll((error) => 
    Effect.sync(() => showErrorDialog(error))
  )
)
```

Benefits:
- Errors are typed and must be handled
- Async operations compose without callback hell
- Resource cleanup is guaranteed via structured concurrency
- Stack traces are preserved for debugging

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
</content>
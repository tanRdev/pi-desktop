<!-- LOGO PLACEHOLDER - Centered at the top -->
<p align="center">
  <img src="docs/assets/logo.svg" alt="PiDesk Logo" width="200" height="200">
  <br>
  <strong>PiDesk</strong>
</p>

<p align="center">
  <a href="https://github.com/tanrdev/pidesk/releases">
    <img src="https://img.shields.io/github/v/release/tanrdev/pidesk?include_prereleases&sort=semver" alt="Latest Release">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/tanrdev/pidesk" alt="License">
  </a>
  <a href="https://github.com/tanrdev/pidesk/issues">
    <img src="https://img.shields.io/github/issues/tanrdev/pidesk" alt="Issues">
  </a>
</p>

---

PiDesk is a macOS desktop application that provides a native Electron wrapper for the [Pi coding agent](https://github.com/mariozechner/pi). It combines a secure, hardened shell with an integrated agent host process, giving you a seamless AI-assisted development experience right on your desktop.

## Features

- **Native macOS Experience** — Built as a first-class macOS citizen with native window management, keyboard shortcuts, and system integration
- **Integrated Agent Host** — Runs the Pi coding agent in a hidden utility process, providing secure, local AI assistance
- **Modern Tech Stack** — Built with Electron, React 19, TypeScript, and Tailwind CSS
- **Secure by Design** — Hardened Electron shell with security best practices built-in
- **Terminal Integration** — Built-in terminal support via node-pty for seamless command execution
- **Rich Editor** — Monaco Editor integration for code editing with syntax highlighting
- **Beautiful UI** — Radix UI components with thoughtful design and smooth interactions

## Requirements

- **macOS** 11.0 (Big Sur) or later
- **Node.js** >= 24.13.1
- **pnpm** >= 10.32.1

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/tanrdev/pidesk.git
cd pidesk

# Install dependencies
pnpm install

# Build the application
pnpm build

# Run in development mode
pnpm dev
```

### Prebuilt Binaries

Download the latest release from the [Releases](https://github.com/tanrdev/pidesk/releases) page.

## Development

PiDesk is organized as a monorepo with the following structure:

```
pidesk/
├── apps/
│   └── desktop/          # Electron desktop application
├── packages/
│   ├── agent-host/       # Agent host utility process
│   ├── shared/           # Shared utilities and IPC channels
│   ├── shell-model/      # Shell data models
│   └── ui/               # Shared UI components and styles
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start development mode (desktop + agent-host) |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Run Biome linter |
| `pnpm format` | Format and fix linting issues |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run unit tests with Vitest |
| `pnpm test:e2e` | Run E2E tests with Playwright |

## Architecture

PiDesk follows a multi-process architecture:

1. **Main Process** — Electron main process handling window management and system integration
2. **Renderer Process** — React-based UI running in a Chromium context
3. **Agent Host Process** — Hidden Node.js process running the Pi coding agent
4. **Utility Process** — Secure isolated process for running untrusted code

IPC communication between processes is handled through type-safe channels defined in `packages/shared/src/ipc/channels.ts`.

## Contributing

We welcome contributions from the community! Here's how to get started:

### Setting Up Your Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a new branch for your feature or fix
4. Follow the installation steps above

### Pull Request Process

1. Ensure your code passes all checks: `pnpm lint && pnpm typecheck && pnpm test`
2. Add tests for any new functionality
3. Update documentation if needed
4. Submit your pull request with a clear description of the changes

### Code Style

- We use [Biome](https://biomejs.dev/) for linting and formatting
- TypeScript strict mode is enabled
- Follow existing patterns in the codebase

### Reporting Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/tanrdev/pidesk/issues) with:

- A clear description of the problem or request
- Steps to reproduce (for bugs)
- Your macOS version and hardware specs
- Any relevant error messages or logs

## Security

PiDesk takes security seriously. If you discover a security vulnerability, please report it privately by emailing security@pidesk.dev (placeholder email) rather than opening a public issue.

Security features include:

- ContextIsolation enabled in Electron
- IPC channels are strictly typed and validated
- Native modules are rebuilt with electron-rebuild
- Content Security Policy headers
- Regular dependency updates

## Roadmap

- [ ] Windows and Linux support
- [ ] Plugin system for custom agents
- [ ] Cloud sync for settings and history
- [ ] Multi-workspace support
- [ ] Custom theme creation

## License

PiDesk is released under the [MIT License](LICENSE).

```
Copyright (c) 2025 PiDesk Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Acknowledgments

- [Pi Coding Agent](https://github.com/mariozechner/pi) by Mario Zechner — The AI agent powering PiDesk
- [Electron](https://www.electronjs.org/) — Cross-platform desktop framework
- [React](https://react.dev/) — UI library
- [Radix UI](https://www.radix-ui.com/) — Accessible UI primitives
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS framework

## Community

- **GitHub Discussions**: [github.com/tanrdev/pidesk/discussions](https://github.com/tanrdev/pidesk/discussions)
- **Discord**: [Join our community](https://discord.gg/pidesk) (placeholder link)
- **Twitter**: [@PiDeskApp](https://twitter.com/PiDeskApp) (placeholder handle)

---

<p align="center">
  Made with ❤️ by the PiDesk contributors
</p>

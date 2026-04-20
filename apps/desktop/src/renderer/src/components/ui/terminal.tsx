import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
import type { Terminal as XTermType } from "@xterm/xterm";
import * as React from "react";
import { cn } from "@/lib/utils";

// xterm + its fit addon + CSS are loaded on demand the first time a Terminal
// mounts. They are heavy (the default export ships ~100kb minified) and are
// only needed when the user actually opens a terminal pane.
let xtermModulePromise: Promise<{
  XTerm: typeof XTermType;
  FitAddon: typeof FitAddonType;
}> | null = null;

function loadXtermModule() {
  if (!xtermModulePromise) {
    xtermModulePromise = Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/xterm/css/xterm.css"),
    ]).then(([xterm, fit]) => ({
      XTerm: xterm.Terminal,
      FitAddon: fit.FitAddon,
    }));
  }
  return xtermModulePromise;
}

interface TerminalProps {
  id: string;
  cwd?: string;
  backend?: "shell" | "pi";
  ownerWindowId?: string;
  className?: string;
  onExit?: () => void;
  onCommandComplete?: () => void;
  /**
   * When true (default), any text selected via mouse/keyboard is copied
   * to the system clipboard automatically, matching common terminal UX.
   */
  copyOnSelect?: boolean;
  /**
   * Milliseconds to debounce ResizeObserver-driven fit/resize calls.
   * Defaults to 100ms. Exposed for tests.
   */
  resizeDebounceMs?: number;
}

/**
 * Imperative handle for callers that want to invoke terminal actions
 * (search, clear) from a toolbar or keyboard shortcut layer that lives
 * outside this component. All methods are safe to call before the
 * terminal has finished initializing (they become no-ops).
 */
export interface TerminalHandle {
  clear(): void;
  focus(): void;
  /**
   * Minimal in-buffer text search. Returns the number of matches and
   * the (0-indexed) row of the first match, or -1 if no match.
   * We avoid the @xterm/addon-search dep by scanning Terminal.buffer.active.
   */
  findAll(needle: string): { count: number; firstRow: number };
}

function syncTerminalSurface(container: HTMLDivElement | null) {
  if (!container) {
    return;
  }

  container.style.backgroundColor = "var(--color-bg-primary)";

  const xtermRoot = container.querySelector<HTMLElement>(".xterm");
  const viewport = container.querySelector<HTMLElement>(".xterm-viewport");
  const screen = container.querySelector<HTMLElement>(".xterm-screen");

  if (xtermRoot) {
    xtermRoot.style.height = "100%";
    xtermRoot.style.backgroundColor = "var(--color-bg-primary)";
  }

  if (viewport) {
    viewport.style.height = "100%";
    viewport.style.backgroundColor = "var(--color-bg-primary)";
  }

  if (screen) {
    screen.style.height = "100%";
    screen.style.backgroundColor = "var(--color-bg-primary)";
  }
}

/**
 * Resolve a CSS custom property to its computed hex value.
 * xterm.js renders to a canvas and cannot parse CSS variable strings like
 * `var(--color-bg-primary)`. We read the computed value from :root so the
 * theme stays in sync with the app's CSS.
 */
function resolveCssVar(varName: string, fallback: string): string {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Build an xterm theme object from the app's CSS variables so the terminal
 * tracks the active theme. Falls back to hardcoded values if a variable is
 * unset (e.g. jsdom in tests).
 */
function buildXtermTheme() {
  const bg = resolveCssVar("--color-bg-primary", "#0C0D0F");
  const fg = resolveCssVar("--color-text-primary", "#d4d4d4");
  return {
    background: bg,
    foreground: fg,
    cursor: fg,
    cursorAccent: bg,
    selectionBackground: "rgba(255,255,255,0.1)",
    black: bg,
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#eab308",
    blue: "#60a5fa",
    magenta: "#a855f7",
    cyan: "#67e8f9",
    white: fg,
    brightBlack: "#525252",
    brightRed: "#f87171",
    brightGreen: "#4ade80",
    brightYellow: "#facc15",
    brightBlue: "#93c5fd",
    brightMagenta: "#c084fc",
    brightCyan: "#a5f3fc",
    brightWhite: "#fafafa",
  };
}

function TerminalSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-bg-primary)]">
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-bg-primary)] p-4">
        <div className="space-y-2">
          <div className="h-3 w-full bg-white/5" />
          <div className="h-3 w-4/5 bg-white/5" />
          <div className="h-3 w-3/4 bg-white/5" />
          <div className="h-3 w-full bg-white/5" />
          <div className="h-3 w-1/2 bg-white/5" />
        </div>
      </div>
    </div>
  );
}

/**
 * Best-effort clipboard copy. Falls back silently if the async clipboard
 * API is unavailable (e.g. insecure context, headless test env).
 */
function copyToClipboard(text: string): void {
  if (!text) return;
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) return;
  clipboard.writeText(text).catch(() => {
    /* swallow: best-effort */
  });
}

export const Terminal = React.forwardRef<TerminalHandle, TerminalProps>(
  function Terminal(
    {
      id,
      cwd,
      backend = "shell",
      ownerWindowId,
      className,
      onExit,
      onCommandComplete,
      copyOnSelect = true,
      resizeDebounceMs = 100,
    },
    ref,
  ) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const terminalRef = React.useRef<XTermType | null>(null);
    const fitAddonRef = React.useRef<FitAddonType | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isInitializing, setIsInitializing] = React.useState(true);

    // Monotonic counter so each mount gets a unique PTY session id.
    // Prevents React StrictMode double-mount from causing the first
    // mount's async cleanup to destroy the second mount's session.
    const mountCounterRef = React.useRef(0);

    // When no workspace is active the main-process terminal handler rejects
    // requests whose cwd is outside the repository allowlist, so we cannot
    // just fall back to a home directory.  Show a hint instead of a blank pane.
    const noCwd = !cwd;

    // Imperative handle for toolbar / shortcut wiring.
    React.useImperativeHandle(
      ref,
      () => ({
        clear() {
          terminalRef.current?.clear();
        },
        focus() {
          terminalRef.current?.focus();
        },
        findAll(needle: string) {
          const term = terminalRef.current;
          if (!term || !needle) return { count: 0, firstRow: -1 };
          const buffer = term.buffer.active;
          let count = 0;
          let firstRow = -1;
          const total = buffer.length;
          for (let i = 0; i < total; i++) {
            const line = buffer.getLine(i);
            if (!line) continue;
            const text = line.translateToString(true);
            if (text.includes(needle)) {
              if (firstRow === -1) firstRow = i;
              count += 1;
            }
          }
          return { count, firstRow };
        },
      }),
      [],
    );

    React.useEffect(() => {
      if (!cwd || !containerRef.current) return;

      // Dispose any leftover xterm instance from a stale mount (handles
      // the case where StrictMode cleanup hasn't resolved yet).
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
      }

      const mountNum = ++mountCounterRef.current;
      const sessionId = mountNum === 1 ? id : `${id}--${mountNum}`;

      let cancelled = false;
      let terminal: XTermType | null = null;
      let resizeObserver: ResizeObserver | null = null;
      let unsubscribe: (() => void) | null = null;
      let createPromise: Promise<unknown> = Promise.resolve();
      let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
      let commandCompleteTimeout: ReturnType<typeof setTimeout> | null = null;
      let awaitingCommandCompletion = false;

      const scheduleCommandComplete = () => {
        if (!awaitingCommandCompletion) {
          return;
        }

        if (commandCompleteTimeout !== null) {
          clearTimeout(commandCompleteTimeout);
        }

        commandCompleteTimeout = setTimeout(() => {
          commandCompleteTimeout = null;
          awaitingCommandCompletion = false;
          onCommandComplete?.();
        }, 300);
      };

      const initPromise = loadXtermModule().then(({ XTerm, FitAddon }) => {
        if (cancelled || !containerRef.current) return;

        terminal = new XTerm({
          theme: buildXtermTheme(),
          fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
          fontSize: 13,
          lineHeight: 1.4,
          cursorBlink: true,
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(containerRef.current);
        syncTerminalSurface(containerRef.current);

        requestAnimationFrame(() => {
          syncTerminalSurface(containerRef.current);
          fitAddon.fit();
        });

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;

        const { cols, rows } = terminal;
        const localTerminal = terminal;
        createPromise = window.piDesktop.terminal
          .create({
            id: sessionId,
            cols,
            rows,
            cwd,
            ownerWindowId: ownerWindowId ?? `terminal-${sessionId}`,
            backend,
          })
          .then((session) => {
            if (cancelled) return session;
            if (session?.status === "error") {
              const errorMessage = "Failed to create terminal session";
              setError(errorMessage);
              localTerminal.write(`\x1b[31mError: ${errorMessage}\x1b[0m\r\n`);
            }
            return session;
          })
          .catch((err) => {
            if (cancelled) return undefined;
            const errorMessage =
              err instanceof Error ? err.message : "Failed to create terminal";
            setError(errorMessage);
            localTerminal.write(`\x1b[31mError: ${errorMessage}\x1b[0m\r\n`);
            localTerminal.write(
              "Terminal functionality may require rebuilding native modules.\r\n",
            );
            return undefined;
          });

        terminal.onData((data: string) => {
          if (data.includes("\r")) {
            awaitingCommandCompletion = true;
            scheduleCommandComplete();
          }

          window.piDesktop.terminal.write(sessionId, data).catch(console.error);
        });

        // Copy-on-select: when the user finishes a selection, push the
        // selected text to the clipboard. xterm fires onSelectionChange
        // on every selection update; we only copy when a non-empty
        // selection exists (i.e. after the drag settles).
        if (copyOnSelect && terminal.onSelectionChange) {
          terminal.onSelectionChange(() => {
            const current = terminalRef.current;
            if (!current) return;
            if (!current.hasSelection()) return;
            const text = current.getSelection();
            if (text) copyToClipboard(text);
          });
        }

        const performResize = () => {
          const addon = fitAddonRef.current;
          const term = terminalRef.current;
          if (!addon || !term) return;
          syncTerminalSurface(containerRef.current);
          addon.fit();
          window.piDesktop.terminal
            .resize(sessionId, term.cols, term.rows)
            .catch(console.error);
        };

        const scheduleResize = () => {
          if (resizeTimeout !== null) {
            clearTimeout(resizeTimeout);
          }
          resizeTimeout = setTimeout(() => {
            resizeTimeout = null;
            performResize();
          }, resizeDebounceMs);
        };

        resizeObserver = new ResizeObserver(scheduleResize);
        resizeObserver.observe(containerRef.current);

        unsubscribe = window.piDesktop.terminal.onEvent((event) => {
          if (event.id !== sessionId) return;

          if (event.type === "data" && event.data) {
            terminalRef.current?.write(event.data);
            scheduleCommandComplete();
          } else if (event.type === "exit") {
            onExit?.();
          }
        });

        setIsInitializing(false);
      });

      return () => {
        cancelled = true;
        // Clear refs SYNCHRONOUSLY so a StrictMode remount can proceed
        // without the stale guard check blocking re-initialization.
        terminalRef.current = null;
        fitAddonRef.current = null;

        // Async cleanup: disconnect observers, dispose xterm DOM, destroy
        // the backend PTY session.  Using the mount-specific `sessionId`
        // ensures this cleanup only destroys *this* mount's session.
        void initPromise.then(() => {
          if (commandCompleteTimeout !== null) {
            clearTimeout(commandCompleteTimeout);
            commandCompleteTimeout = null;
          }
          if (resizeTimeout !== null) {
            clearTimeout(resizeTimeout);
            resizeTimeout = null;
          }
          resizeObserver?.disconnect();
          unsubscribe?.();
          terminal?.dispose();
          void createPromise.finally(() => {
            window.piDesktop.terminal.destroy(sessionId).catch(console.error);
          });
        });
      };
    }, [
      id,
      cwd,
      backend,
      ownerWindowId,
      onExit,
      onCommandComplete,
      copyOnSelect,
      resizeDebounceMs,
    ]);

    return (
      <>
        {noCwd ? (
          <div
            className={cn(
              "flex h-full w-full flex-col items-center justify-center bg-[var(--color-bg-primary)] p-4 text-center",
              className,
            )}
          >
            <div className="text-sm text-white/30">No workspace selected</div>
            <div className="mt-1 text-xs text-white/20">
              Select a workspace to open a terminal session.
            </div>
          </div>
        ) : error ? (
          <div
            className={cn(
              "flex h-full w-full flex-col bg-[var(--color-bg-primary)]",
              className,
            )}
          >
            <div
              className={cn(
                "flex h-full flex-col items-center justify-center gap-3 p-4 text-center",
                "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
                "motion-reduce:animate-none",
              )}
            >
              <div className="text-sm text-white/40">Terminal Error</div>
              <div className="text-xs text-white/40">{error}</div>
              <div className="text-xs text-white/30">
                Run{" "}
                <code
                  className={cn(
                    "bg-white/[0.08] px-1.5 py-0.5 text-white/60",
                    "transition-all duration-150",
                    "hover:bg-white/[0.12]",
                  )}
                >
                  bun rebuild node-pty
                </code>{" "}
                to rebuild native modules.
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative h-full w-full bg-[var(--color-bg-primary)]",
              className,
            )}
          >
            {/* Loading overlay — disappears once xterm.js initializes */}
            {isInitializing && (
              <div className="absolute inset-0 z-10">
                <TerminalSkeleton />
              </div>
            )}
            <div className="flex h-full w-full flex-col">
              <div className="min-h-0 flex-1 overflow-hidden bg-[var(--color-bg-primary)]">
                <div
                  ref={containerRef}
                  className="h-full w-full bg-[var(--color-bg-primary)]"
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  },
);

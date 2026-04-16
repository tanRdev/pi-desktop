import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
import type { Terminal as XTermType } from "@xterm/xterm";
import { Skeleton } from "boneyard-js/react";
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

export function Terminal({
  id,
  cwd,
  backend = "shell",
  ownerWindowId,
  className,
  onExit,
}: TerminalProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<XTermType | null>(null);
  const fitAddonRef = React.useRef<FitAddonType | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitializing, setIsInitializing] = React.useState(true);

  React.useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    let cancelled = false;
    let terminal: XTermType | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let unsubscribe: (() => void) | null = null;
    let createPromise: Promise<unknown> = Promise.resolve();

    const initPromise = loadXtermModule().then(({ XTerm, FitAddon }) => {
      if (cancelled || !containerRef.current) return;

      terminal = new XTerm({
        theme: {
          background: "var(--color-bg-primary)",
          foreground: "#d4d4d4",
          cursor: "#d4d4d4",
          cursorAccent: "var(--color-bg-primary)",
          selectionBackground: "rgba(255,255,255,0.1)",
          black: "var(--color-bg-primary)",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#60a5fa",
          magenta: "#a855f7",
          cyan: "#67e8f9",
          white: "#d4d4d4",
          brightBlack: "#525252",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#facc15",
          brightBlue: "#93c5fd",
          brightMagenta: "#c084fc",
          brightCyan: "#a5f3fc",
          brightWhite: "#fafafa",
        },
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
      // Hold a handle to the create promise so cleanup can await it before
      // destroying. Without this the StrictMode dev double-mount causes:
      //   create(id) -> cleanup -> destroy(id) -> create resolves (zombie) -> create(id again)
      createPromise = window.piDesktop.terminal
        .create({
          id,
          cols,
          rows,
          cwd,
          ownerWindowId: ownerWindowId ?? `terminal-${id}`,
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
        window.piDesktop.terminal.write(id, data).catch(console.error);
      });

      const handleResize = () => {
        if (fitAddonRef.current && terminalRef.current) {
          syncTerminalSurface(containerRef.current);
          fitAddonRef.current.fit();
          const { cols, rows } = terminalRef.current;
          window.piDesktop.terminal.resize(id, cols, rows).catch(console.error);
        }
      };

      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerRef.current);

      unsubscribe = window.piDesktop.terminal.onEvent((event) => {
        if (event.id !== id) return;

        if (event.type === "data" && event.data) {
          terminalRef.current?.write(event.data);
        } else if (event.type === "exit") {
          onExit?.();
        }
      });

      setIsInitializing(false);
    });

    return () => {
      cancelled = true;
      // Await both the dynamic module load and the backend create before
      // disposing, to preserve the StrictMode race protection.
      void initPromise.then(() => {
        resizeObserver?.disconnect();
        unsubscribe?.();
        void createPromise.finally(() => {
          window.piDesktop.terminal.destroy(id).catch(console.error);
        });
        terminal?.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
      });
    };
  }, [id, cwd, backend, ownerWindowId, onExit]);

  return (
    <Skeleton
      name="terminal"
      loading={isInitializing}
      fixture={<TerminalSkeleton />}
    >
      {error ? (
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
            "flex h-full w-full flex-col bg-[var(--color-bg-primary)]",
            className,
          )}
        >
          <div className="min-h-0 flex-1 overflow-hidden bg-[var(--color-bg-primary)]">
            <div
              ref={containerRef}
              className={cn(
                "h-full w-full bg-[var(--color-bg-primary)]",
                "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
                "motion-reduce:animate-none",
              )}
            />
          </div>
        </div>
      )}
    </Skeleton>
  );
}

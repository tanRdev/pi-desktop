import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import * as React from "react";
import { cn } from "@/lib/utils";

import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  id: string;
  cwd?: string;
  backend?: "shell" | "pi";
  ownerWindowId?: string;
  className?: string;
  onExit?: () => void;
}

// Terminal icon component
function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

// Plus icon component
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// Close/X icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// Chevron down icon for dropdown
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="10"
      height="10"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
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
  const terminalRef = React.useRef<XTerm | null>(null);
  const fitAddonRef = React.useRef<FitAddon | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [_isInitialized, setIsInitialized] = React.useState(false);
  const terminalLabel = backend === "pi" ? "Pi CLI" : "zsh";

  React.useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new XTerm({
      theme: {
        background: "#0c0c0c",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        cursorAccent: "#0c0c0c",
        selectionBackground: "rgba(255,255,255,0.1)",
        black: "#0c0c0c",
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

    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const { cols, rows } = terminal;
    (async () => {
      try {
        const session = await window.pidesk.terminal.create({
          id,
          cols,
          rows,
          cwd,
          ownerWindowId: ownerWindowId ?? `terminal-${id}`,
          backend,
        });
        if (session?.status === "error") {
          const errorMessage = "Failed to create terminal session";
          setError(errorMessage);
          terminal.write(`\x1b[31mError: ${errorMessage}\x1b[0m\r\n`);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create terminal";
        setError(errorMessage);
        terminal.write(`\x1b[31mError: ${errorMessage}\x1b[0m\r\n`);
        terminal.write(
          "Terminal functionality may require rebuilding native modules.\r\n",
        );
      }
    })();

    terminal.onData((data) => {
      window.pidesk.terminal.write(id, data).catch(console.error);
    });

    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = terminalRef.current;
        window.pidesk.terminal.resize(id, cols, rows).catch(console.error);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    const unsubscribe = window.pidesk.terminal.onEvent((event) => {
      if (event.id !== id) return;

      if (event.type === "data" && event.data) {
        terminalRef.current?.write(event.data);
      } else if (event.type === "exit") {
        onExit?.();
      }
    });

    setIsInitialized(true);

    return () => {
      resizeObserver.disconnect();
      unsubscribe();
      window.pidesk.terminal.destroy(id).catch(console.error);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [id, cwd, backend, ownerWindowId, onExit]);

  if (error) {
    return (
      <div
        className={cn(
          "w-[400px] border-l border-white/[0.06] bg-[#0c0c0c]",
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
                "rounded bg-white/[0.08] px-1.5 py-0.5 text-white/60",
                "transition-all duration-150",
                "hover:bg-white/[0.12]",
              )}
            >
              pnpm rebuild node-pty
            </code>{" "}
            to rebuild native modules.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-[400px] flex-col border-l border-white/[0.06] bg-[#0c0c0c]",
        className,
      )}
    >
      {/* Terminal Header - Cursor Glass style */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.04] px-3">
        <div className="flex items-center gap-2">
          <TerminalIcon className="text-white/40" />
          <span className="text-[11px] font-medium text-white/50">
            {terminalLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded text-white/40 transition-colors hover:text-white/60 hover:bg-white/[0.05]"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded text-white/40 transition-colors hover:text-white/60 hover:bg-white/[0.05]"
          >
            <XIcon />
          </button>
        </div>
      </div>

      {/* Tab Bar - Cursor style */}
      <div className="flex h-8 shrink-0 items-center border-b border-white/[0.04] px-1">
        <button
          type="button"
          className="flex h-7 items-center gap-1 px-2 text-[11px] font-medium text-white/60 border-b border-white/20 bg-white/[0.02]"
        >
          <ChevronDownIcon />
          <span>{backend === "pi" ? "pi" : "main"}</span>
        </button>
      </div>

      {/* Terminal Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className={cn(
            "h-full w-full",
            "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
            "motion-reduce:animate-none",
          )}
        />
      </div>
    </div>
  );
}

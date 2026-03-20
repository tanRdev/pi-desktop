import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import * as React from "react";
import { cn } from "@/lib/utils";

import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  id: string;
  cwd?: string;
  backend?: "shell" | "lazygit" | "pi-linked" | "tmux-attach";
  linkedThreadId?: string;
  ownerWindowId?: string;
  className?: string;
  onExit?: () => void;
}

export function Terminal({
  id,
  cwd,
  backend = "shell",
  linkedThreadId,
  ownerWindowId,
  className,
  onExit,
}: TerminalProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<XTerm | null>(null);
  const fitAddonRef = React.useRef<FitAddon | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [_isInitialized, setIsInitialized] = React.useState(false);

  React.useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new XTerm({
      theme: {
        background: "#121212",
        foreground: "#e5e5e5",
        cursor: "#e5e5e5",
        cursorAccent: "#121212",
        selectionBackground: "#404040",
        black: "#171717",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#a3a3a3",
        magenta: "#a855f7",
        cyan: "#d4d4d4",
        white: "#e5e5e5",
        brightBlack: "#525252",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#d4d4d4",
        brightMagenta: "#c084fc",
        brightCyan: "#e5e5e5",
        brightWhite: "#fafafa",
      },
      fontFamily:
        '"IBM Plex Mono", "JetBrains Mono", "SF Mono", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    // Wait for the container to be visible before fitting
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Create PTY via main process
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
          linkedThreadId,
        });
        // The API returns a rich TerminalSession descriptor; surface any immediate errors
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

    // Handle terminal input
    terminal.onData((data) => {
      window.pidesk.terminal.write(id, data).catch(console.error);
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = terminalRef.current;
        window.pidesk.terminal.resize(id, cols, rows).catch(console.error);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // Handle terminal events from main process
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
  }, [id, cwd, backend, linkedThreadId, ownerWindowId, onExit]);

  if (error) {
    return (
      <div className={className}>
        <div
          className={cn(
            "flex h-full flex-col items-center justify-center gap-3 p-4 text-center",
            "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
            "motion-reduce:animate-none",
          )}
        >
          <div className="text-sm text-destructive">Terminal Error</div>
          <div className="text-xs text-muted-foreground">{error}</div>
          <div className="text-xs text-muted-foreground">
            Run{" "}
            <code
              className={cn(
                "rounded bg-surface-2 px-1",
                "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
                "hover:bg-surface-3 hover:scale-105",
                "active:scale-[0.97] motion-reduce:active:scale-100",
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
      ref={containerRef}
      className={cn(
        className,
        "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
        "motion-reduce:animate-none",
      )}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

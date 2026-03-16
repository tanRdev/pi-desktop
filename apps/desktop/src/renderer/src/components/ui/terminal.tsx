import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import * as React from "react";

import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  id: string;
  cwd?: string;
  className?: string;
  onExit?: () => void;
}

export function Terminal({ id, cwd, className, onExit }: TerminalProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<XTerm | null>(null);
  const fitAddonRef = React.useRef<FitAddon | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);

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
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e5e5e5",
        brightBlack: "#525252",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
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
    window.pidesk.terminal.create(id, { cols, rows, cwd }).catch((err) => {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create terminal";
      setError(errorMessage);
      terminal.write(`\x1b[31mError: ${errorMessage}\x1b[0m\r\n`);
      terminal.write(
        "Terminal functionality may require rebuilding native modules.\r\n",
      );
    });

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
  }, [id, cwd, onExit]);

  if (error) {
    return (
      <div className={className}>
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <div className="text-sm text-destructive">Terminal Error</div>
          <div className="text-xs text-muted-foreground">{error}</div>
          <div className="text-xs text-muted-foreground">
            Run{" "}
            <code className="rounded bg-surface-2 px-1">
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
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

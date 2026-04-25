import { cn } from "@pi-desktop/ui";
import * as React from "react";
import type { LeftSidebarProps } from "./left-sidebar";
import { LeftSidebar } from "./left-sidebar";
import type { StatusBarProps } from "./status-bar";
import { StatusBar } from "./status-bar";
import type { WorkspaceShellMainPaneProps } from "./workspace-shell-main-pane";
import { WorkspaceShellMainPane } from "./workspace-shell-main-pane";
import type { WorkspaceShellTerminalAsideProps } from "./workspace-shell-terminal-aside";
import { WorkspaceShellTerminalAside } from "./workspace-shell-terminal-aside";

export interface WorkspaceShellLayoutProps {
  leftSidebarProps: LeftSidebarProps;
  mainPaneProps: WorkspaceShellMainPaneProps;
  terminalAsideProps: WorkspaceShellTerminalAsideProps | null;
  statusBarProps: StatusBarProps;
}

function WorkspaceShellLayoutImpl({
  leftSidebarProps,
  mainPaneProps,
  terminalAsideProps,
  statusBarProps,
}: WorkspaceShellLayoutProps) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden select-none">
      <div className="relative flex min-h-0 flex-1 select-none">
        <LeftSidebar {...leftSidebarProps} />

        <main
          data-testid="chat-first-layout"
          className={cn(
            "relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden",
            "bg-[var(--shell-main-bg)]",
          )}
        >
          <WorkspaceShellMainPane {...mainPaneProps} />
        </main>

        {terminalAsideProps ? (
          <WorkspaceShellTerminalAside {...terminalAsideProps} />
        ) : null}
      </div>

      <StatusBar {...statusBarProps} />
    </div>
  );
}

export const WorkspaceShellLayout = React.memo(WorkspaceShellLayoutImpl);

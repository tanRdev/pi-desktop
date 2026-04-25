import {
  ArrowClockwise,
  DownloadSimple,
  Warning,
  X,
} from "@phosphor-icons/react";
import { Button, cn } from "@pi-desktop/ui";
import type * as React from "react";
import { useUpdater } from "@/hooks/use-updater";

export interface UpdateBannerProps {
  className?: string;
}

export function UpdateBanner({ className }: UpdateBannerProps) {
  const { state, actions, isAvailable, isDownloaded, isError } = useUpdater();

  const visible =
    isAvailable || isDownloaded || isError || state.status === "downloading";

  if (!visible) {
    return null;
  }

  if (state.status === "downloading") {
    return (
      <UpdateBannerShell
        className={className}
        tone="info"
        icon={<DownloadSimple className="size-3.5" />}
        title={`Downloading update${
          state.updateInfo ? ` ${state.updateInfo.version}` : ""
        }`}
        description={`${Math.round(state.downloadPercent)}%`}
      />
    );
  }

  if (isError && state.error) {
    return (
      <UpdateBannerShell
        className={className}
        tone="error"
        icon={<Warning className="size-3.5" />}
        title="Update failed"
        description={state.error.message}
        actions={
          <>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                void actions.check();
              }}
            >
              <ArrowClockwise className="size-3" />
              Retry
            </Button>
            <DismissButton onClick={actions.dismissError} />
          </>
        }
      />
    );
  }

  if (isDownloaded) {
    return (
      <UpdateBannerShell
        className={className}
        tone="success"
        icon={<ArrowClockwise className="size-3.5" />}
        title={
          state.updateInfo
            ? `Pi Desktop ${state.updateInfo.version} is ready`
            : "Update ready"
        }
        description="Restart to apply the update."
        actions={
          <Button size="xs" variant="default" onClick={actions.install}>
            Restart now
          </Button>
        }
      />
    );
  }

  // isAvailable
  return (
    <UpdateBannerShell
      className={className}
      tone="info"
      icon={<DownloadSimple className="size-3.5" />}
      title={
        state.updateInfo
          ? `Pi Desktop ${state.updateInfo.version} is available`
          : "An update is available"
      }
      description="Download and install when ready."
      actions={
        <Button
          size="xs"
          variant="default"
          onClick={() => {
            void actions.download();
          }}
        >
          Download
        </Button>
      }
    />
  );
}

interface UpdateBannerShellProps {
  className?: string;
  tone: "info" | "success" | "error";
  icon: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

function UpdateBannerShell({
  className,
  tone,
  icon,
  title,
  description,
  actions,
}: UpdateBannerShellProps) {
  return (
    <output
      aria-live="polite"
      className={cn(
        "flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-2 text-[11px]",
        tone === "info" && "bg-white/[0.06] text-white/80",
        tone === "success" && "bg-emerald-500/10 text-emerald-200",
        tone === "error" && "bg-red-500/10 text-red-200",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-5 items-center justify-center",
          tone === "info" && "text-white/50",
          tone === "success" && "text-emerald-300",
          tone === "error" && "text-red-300",
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title}</span>
        {description ? (
          <span className="truncate text-[11px] text-white/50">
            {description}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </output>
  );
}

interface DismissButtonProps {
  onClick: () => void;
}

function DismissButton({ onClick }: DismissButtonProps) {
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      aria-label="Dismiss update notification"
      onClick={onClick}
    >
      <X className="size-3" />
    </Button>
  );
}

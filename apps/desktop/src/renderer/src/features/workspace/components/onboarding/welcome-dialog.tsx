import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  FolderOpen,
  ICON_SIZE_MD,
  ICON_SIZE_XL,
  Keyboard,
  Lightning,
  Pi,
} from "@/components/ui/icons";
import type { RegisteredShortcut } from "@/lib/keyboard";
import {
  detectPlatform,
  formatShortcut,
  globalShortcutRegistry,
} from "@/lib/keyboard";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "pi-desktop:has-onboarded";
const TOTAL_STEPS = 4;

export type WelcomeDialogProps = {
  open: boolean;
  onComplete: () => void;
};

function useShortcuts(): ReadonlyArray<RegisteredShortcut> {
  return React.useMemo(() => globalShortcutRegistry.list(), []);
}

function StepIndicators({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          data-testid={`step-dot-${i}`}
          className={cn(
            "inline-block size-1.5 rounded-full transition-colors duration-[var(--duration-fast)]",
            i === current
              ? "bg-white/80"
              : i < current
                ? "bg-white/40"
                : "bg-white/10",
          )}
        />
      ))}
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-8">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06]">
        <Pi className={ICON_SIZE_XL} />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-sm font-normal text-white/90">
          Welcome to Pi Desktop
        </h2>
        <p className="max-w-[320px] text-xs leading-relaxed text-white/40">
          Your AI-powered development environment. Code, chat, and ship faster
          with an intelligent assistant right beside your workspace.
        </p>
      </div>
    </div>
  );
}

function groupShortcuts(
  shortcuts: ReadonlyArray<RegisteredShortcut>,
): Array<[string, RegisteredShortcut[]]> {
  const groups = new Map<string, RegisteredShortcut[]>();
  for (const s of shortcuts) {
    const bucket = groups.get(s.group);
    if (bucket === undefined) groups.set(s.group, [s]);
    else bucket.push(s);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function ShortcutsStep() {
  const shortcuts = useShortcuts();
  const platform = React.useMemo(() => detectPlatform(), []);
  const groups = React.useMemo(() => groupShortcuts(shortcuts), [shortcuts]);

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-6">
      <Keyboard className={cn(ICON_SIZE_XL, "text-white/60")} />
      <h2 className="text-sm font-normal text-white/90">Keyboard shortcuts</h2>
      {groups.length === 0 ? (
        <p className="text-xs text-white/40">No shortcuts registered yet.</p>
      ) : (
        <div className="w-full max-h-[200px] overflow-y-auto space-y-3">
          {groups.map(([groupName, items]) => (
            <section key={groupName} className="space-y-1">
              <h3 className="text-[11px] uppercase tracking-wider text-white/50">
                {groupName}
              </h3>
              <ul className="space-y-0.5">
                {items.slice(0, 5).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-0.5"
                  >
                    <span className="text-xs text-white/60">
                      {entry.description}
                    </span>
                    <span className="flex gap-1">
                      {entry.parsed.map((p, idx) => (
                        <kbd
                          key={`${entry.id}-${idx}`}
                          className={cn(
                            "px-1.5 py-0.5 rounded",
                            "border border-white/[0.08]",
                            "bg-white/[0.06]",
                            "text-[11px] font-mono text-white/50",
                          )}
                        >
                          {formatShortcut(p, platform)}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeSelectedPaths(selection: unknown): string[] {
  if (typeof selection === "string") {
    return selection ? [selection] : [];
  }

  if (!Array.isArray(selection)) {
    return [];
  }

  return selection.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
}

function ChooseWorkspaceStep({
  onWorkspaceSelected,
}: {
  onWorkspaceSelected: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const handleOpen = React.useCallback(async () => {
    setBusy(true);
    try {
      let selectedPaths: string[] = [];

      if (
        typeof window !== "undefined" &&
        window.piDesktop?.dialog &&
        typeof (window.piDesktop.dialog as Record<string, unknown>)
          .openDirectory === "function"
      ) {
        const openDirectoryFn = (
          window.piDesktop.dialog as Record<string, unknown> & {
            openDirectory?: () => Promise<unknown>;
          }
        ).openDirectory;
        selectedPaths = normalizeSelectedPaths(await openDirectoryFn?.());
      } else if (typeof window !== "undefined" && window.piDesktop?.dialog) {
        selectedPaths = normalizeSelectedPaths(
          await window.piDesktop.dialog.showOpenDialog({
            properties: ["openDirectory"],
            title: "Choose your first workspace",
          }),
        );
      }

      const selectedPath = selectedPaths[0];
      if (!selectedPath) {
        return;
      }

      await window.piDesktop.repositories.add(selectedPath);
      onWorkspaceSelected();
    } finally {
      setBusy(false);
    }
  }, [onWorkspaceSelected]);

  return (
    <div className="flex flex-col items-center gap-5 px-6 py-8">
      <FolderOpen className={cn(ICON_SIZE_XL, "text-white/60")} />
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-sm font-normal text-white/90">
          Choose your first workspace
        </h2>
        <p className="max-w-[320px] text-xs leading-relaxed text-white/40">
          Open a folder to start working. Pi Desktop will watch your project and
          provide AI assistance as you code.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="default"
        disabled={busy}
        onClick={handleOpen}
        data-testid="onboarding-open-folder"
      >
        <FolderOpen className={ICON_SIZE_MD} />
        Open Folder
      </Button>
    </div>
  );
}

function AllSetStep() {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-8">
      <CheckCircle className={cn(ICON_SIZE_XL, "text-white/60")} />
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-sm font-normal text-white/90">
          You&apos;re all set!
        </h2>
        <p className="max-w-[320px] text-xs leading-relaxed text-white/40">
          Pi Desktop is ready. Start a conversation, open a file, or explore the
          sidebar to jump in.
        </p>
      </div>
    </div>
  );
}

export function WelcomeDialog({
  open,
  onComplete,
}: WelcomeDialogProps): React.ReactElement {
  const [step, setStep] = React.useState(0);

  const next = React.useCallback(() => {
    setStep((s) => {
      if (s >= TOTAL_STEPS - 1) return s;
      return s + 1;
    });
  }, []);

  const prev = React.useCallback(() => {
    setStep((s) => {
      if (s <= 0) return s;
      return s - 1;
    });
  }, []);

  const complete = React.useCallback(() => {
    try {
      globalThis.localStorage.setItem(ONBOARDING_KEY, "true");
    } catch {}
    onComplete();
  }, [onComplete]);

  const handleEscape = React.useCallback(() => {
    complete();
  }, [complete]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (step < TOTAL_STEPS - 1) {
          next();
        } else {
          complete();
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleEscape();
      }
    },
    [step, next, complete, handleEscape],
  );

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        complete();
      }
    },
    [complete],
  );

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="welcome-dialog"
        className="sm:max-w-[480px] w-[min(480px,calc(100vw-2rem))]"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Welcome to Pi Desktop</DialogTitle>
          <DialogDescription className="sr-only">
            Onboarding wizard for first-time users.
          </DialogDescription>
        </DialogHeader>

        <div data-step={step}>
          {step === 0 && <WelcomeStep />}
          {step === 1 && <ShortcutsStep />}
          {step === 2 && <ChooseWorkspaceStep onWorkspaceSelected={complete} />}
          {step === 3 && <AllSetStep />}
        </div>

        <StepIndicators current={step} total={TOTAL_STEPS} />

        <DialogFooter className="flex-row items-center justify-between">
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={prev}
                data-testid="onboarding-back"
              >
                Back
              </Button>
            )}
            {step < TOTAL_STEPS - 1 && (
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={complete}
                data-testid="onboarding-skip"
              >
                Skip
              </Button>
            )}
          </div>
          <div>
            {isLast ? (
              <Button
                type="button"
                variant="default"
                size="default"
                onClick={complete}
                data-testid="onboarding-get-started"
              >
                <Lightning className={ICON_SIZE_MD} />
                Get Started
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="default"
                onClick={next}
                data-testid="onboarding-next"
              >
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ONBOARDING_KEY };

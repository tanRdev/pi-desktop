import { cn } from "@pi-desktop/ui";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Faders,
  Gear,
  PaintBrush,
  ShieldLock,
  TerminalWindow,
} from "@/components/ui/phosphor-icons";
import { AppearanceSection } from "./sections/appearance";
import { DangerZoneSection } from "./sections/danger-zone";
import { EditorSection } from "./sections/editor";
import { TerminalSection } from "./sections/terminal";
import { useSettings } from "./use-settings";

type SectionId = "appearance" | "editor" | "terminal" | "danger-zone";

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "appearance", label: "Appearance", Icon: PaintBrush },
  { id: "editor", label: "Editor", Icon: Faders },
  { id: "terminal", label: "Terminal", Icon: TerminalWindow },
  { id: "danger-zone", label: "Danger zone", Icon: ShieldLock },
];

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { settings, update, reset } = useSettings();
  const [activeSection, setActiveSection] = useState<SectionId>("appearance");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-dialog"
        className="sm:max-w-3xl w-[min(860px,calc(100vw-2rem))] p-0"
      >
        <DialogHeader className="flex-row items-center gap-2">
          <Gear className="size-4 text-white/60" />
          <div className="flex flex-col gap-0.5">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Preferences are saved automatically.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-[180px_1fr] min-h-[420px]">
          <nav
            aria-label="Settings sections"
            className="flex flex-col gap-0.5 border-r border-white/[0.06] bg-[var(--color-bg-secondary)] p-2"
          >
            {SECTIONS.map(({ id, label, Icon }) => {
              const isActive = id === activeSection;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-section={id}
                  data-testid={`settings-tab-${id}`}
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors outline-none",
                    isActive
                      ? "bg-white/[0.06] text-white/90"
                      : "text-white/50 hover:bg-white/[0.06] hover:text-white/80",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
          <div
            data-testid="settings-panel"
            data-active-section={activeSection}
            className="flex flex-col gap-6 overflow-y-auto bg-[var(--color-bg-primary)] px-6 py-5"
          >
            {activeSection === "appearance" ? (
              <AppearanceSection settings={settings} update={update} />
            ) : null}
            {activeSection === "editor" ? (
              <EditorSection settings={settings} update={update} />
            ) : null}
            {activeSection === "terminal" ? (
              <TerminalSection settings={settings} update={update} />
            ) : null}
            {activeSection === "danger-zone" ? (
              <DangerZoneSection onResetPreferences={reset} />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import type React from "react";
import { useEffect, useState } from "react";
import { Bot, Palette } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import {
  SETTINGS_MODAL_SECTION_IDS,
  type SettingsModalSection,
} from "./navigation";
import { AISettingsSection, InterfaceSettingsSection } from "./sections";
import { useSettings } from "./settings-context";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  id: SettingsModalSection;
  label: string;
  icon: React.ReactNode;
}

export const SETTINGS_MODAL_SECTIONS: NavItem[] =
  SETTINGS_MODAL_SECTION_IDS.map((id) => ({
    id,
    label: id === "ai" ? "AI & Models" : "Interface",
    icon:
      id === "ai" ? (
        <Bot className="h-4 w-4" />
      ) : (
        <Palette className="h-4 w-4" />
      ),
  }));

function renderSection(section: SettingsModalSection) {
  switch (section) {
    case "ai":
      return <AISettingsSection />;
    case "interface":
      return <InterfaceSettingsSection />;
  }
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsModalSection>("ai");
  const [isAnimating, setIsAnimating] = useState(false);
  const { resetAll } = useSettings();

  const handleSectionChange = (section: SettingsModalSection) => {
    if (section === activeSection) return;
    setIsAnimating(true);
    setActiveSection(section);
  };

  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 250);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-modal"
        className="flex h-[76vh] max-h-[76vh] w-[min(880px,calc(100vw-64px))] max-w-[880px] flex-col gap-0 overflow-hidden rounded-lg border border-white/[0.06] bg-[var(--color-bg-tertiary)] p-0 shadow-[0_16px_48px_rgba(0,0,0,0.5)] select-none"
      >
        <DialogHeader className="flex flex-row items-center justify-between select-none">
          <div className="space-y-1 select-none">
            <p className="text-[14px] font-medium uppercase tracking-[0.18em] text-white/40">
              Preferences
            </p>
            <DialogTitle className="font-heading text-[20px] font-semibold tracking-[-0.02em] text-white/90">
              Workspace settings
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <nav className="w-52 shrink-0 border-r border-white/[0.06] bg-[var(--color-bg-primary)] px-2 py-4 select-none">
            <div className="flex flex-col gap-1">
              {SETTINGS_MODAL_SECTIONS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  data-testid={`settings-nav-${item.id}`}
                  onClick={() => handleSectionChange(item.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2.5 text-left",
                    "transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                    "hover:bg-white/[0.04] hover:text-white",
                    activeSection === item.id
                      ? "bg-white/[0.06] text-white/90"
                      : "text-white/40",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-sm text-white/40">
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-current">
                      {item.label}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </nav>

          <ScrollArea className="flex-1 bg-[var(--color-bg-tertiary)]">
            <div className="mx-auto max-w-2xl p-7">
              <div
                className={cn(
                  "transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                  isAnimating
                    ? "opacity-0 translate-y-1"
                    : "opacity-100 translate-y-0",
                )}
              >
                {renderSection(activeSection)}
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] bg-[var(--color-bg-secondary)] px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetAll();
            }}
            className={cn(
              "rounded-sm px-3 text-[14px] font-medium text-white/40 hover:bg-white/[0.04] hover:text-white/80",
            )}
          >
            Reset visible settings
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className={cn(
              "rounded-sm px-5 tracking-[-0.01em]",
              "transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)]",
            )}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

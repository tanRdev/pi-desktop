import type React from "react";
import { useEffect, useState } from "react";
import { Bot, Palette, X } from "@/components/ui/icons";
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

  // Handle section change with animation
  const handleSectionChange = (section: SettingsModalSection) => {
    if (section === activeSection) return;
    setIsAnimating(true);
    setActiveSection(section);
  };

  // Reset animation state after transition
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 250);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, activeSection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[90vw] max-w-[1000px] flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-6 py-4">
          <DialogTitle className="text-lg font-semibold transition-opacity duration-200 ease-out">Settings</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-md chrome-icon-button",
              "transition-all duration-150",
              "hover:bg-surface-2 hover:scale-105",
              "active:scale-[0.97]",
            )}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar Navigation */}
          <nav className="w-48 shrink-0 border-r border-border bg-surface-1/50">
            <div className="flex flex-col gap-1 p-3">
              {SETTINGS_MODAL_SECTIONS.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleSectionChange(item.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    "transition-all duration-150",
                    "hover:translate-x-0.5",
                    "active:scale-[0.97]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    activeSection === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                  style={{
                    animationDelay: `${index * 40}ms`,
                    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)"
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              <div
                className={cn(
                  "transition-all duration-200",
                  isAnimating ? "opacity-0 scale-[0.98] translate-y-1" : "opacity-100 scale-100 translate-y-0"
                )}
                style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
              >
                {renderSection(activeSection)}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3 bg-surface-1/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetAll();
            }}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              "transition-all duration-150",
              "hover:translate-x-0.5",
              "active:scale-[0.97]",
            )}
            style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
          >
            Reset All Settings
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className={cn(
              "transition-all duration-150",
              "hover:scale-105 active:scale-[0.97]",
            )}
            style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

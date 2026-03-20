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
  }, [isAnimating]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[90vw] max-w-[1000px] flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-[#474747]/30 bg-[#0e0e0e] px-6 py-4">
          <DialogTitle className="text-sm font-bold uppercase tracking-[0.2em] font-headline text-white">
            Settings
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-none",
              "transition-all duration-150",
              "hover:bg-[#353535] hover:text-white",
              "active:scale-95",
            )}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar Navigation */}
          <nav className="w-52 shrink-0 border-r border-[#474747]/20 bg-[#0e0e0e]">
            <div className="flex flex-col gap-0.5 p-2">
              {SETTINGS_MODAL_SECTIONS.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleSectionChange(item.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-none px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider",
                    "transition-all duration-100",
                    "hover:bg-[#131313] hover:text-white",
                    activeSection === item.id
                      ? "bg-[#131313] text-white border-l-2 border-white"
                      : "text-[#474747]",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content Area */}
          <ScrollArea className="flex-1 bg-[#131313]">
            <div className="p-8">
              <div
                className={cn(
                  "transition-all duration-150",
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

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#474747]/30 px-6 py-4 bg-[#0e0e0e]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetAll();
            }}
            className={cn(
              "text-[10px] font-mono uppercase tracking-widest text-[#474747] hover:text-white rounded-none",
            )}
          >
            Reset All Settings
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className={cn(
              "bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] rounded-none px-6",
              "hover:bg-[#d4d4d4] transition-all",
            )}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

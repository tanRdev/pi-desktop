import type React from "react";
import { useState } from "react";
import { Bot, Palette, X } from "@/components/ui/icons";
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
  const { resetAll } = useSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[90vw] max-w-[1000px] flex-col gap-0 p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-6 py-4">
          <DialogTitle className="text-lg font-semibold">Settings</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar Navigation */}
          <nav className="w-48 shrink-0 border-r border-border bg-surface-1/50">
            <div className="flex flex-col gap-1 p-3">
              {SETTINGS_MODAL_SECTIONS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    activeSection === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-6">{renderSection(activeSection)}</div>
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
            className="text-muted-foreground hover:text-foreground"
          >
            Reset All Settings
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

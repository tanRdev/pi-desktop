import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import React from "react"

export interface DialogWithSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  sidebar: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function DialogWithSidebar({
  open,
  onOpenChange,
  title,
  sidebar,
  children,
  className,
}: DialogWithSidebarProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-2xl overflow-hidden border-white/[0.08] bg-[hsl(222,24%,8%)] p-0",
        className
      )}>
        <DialogHeader className="border-b border-white/[0.06] px-4 py-3">
          <DialogTitle className="text-sm font-semibold text-zinc-200">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex h-[400px]">
          {/* Sidebar */}
          <div className="w-44 shrink-0 border-r border-white/[0.06] bg-white/[0.02] p-2">
            {sidebar}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export interface SettingsSectionProps {
  title: string
  description?: string
  children: React.ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        {description && (
          <p className="text-xs text-zinc-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

export interface SettingsNavItemProps {
  icon?: React.ReactNode
  label: string
  isActive?: boolean
  onClick?: () => void
}

export function SettingsNavItem({ icon, label, isActive, onClick }: SettingsNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
        isActive
          ? "bg-white/[0.08] text-zinc-200"
          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300"
      )}
    >
      {icon && <span className="text-zinc-500">{icon}</span>}
      {label}
    </button>
  )
}

// Cursor Glass Chat - Complete redesign to match Cursor exactly
import { At, Paperclip, Plus, Star } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface CursorChatProps {
  className?: string;
}

export function CursorChat({ className }: CursorChatProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col bg-[var(--color-bg-secondary)] select-none",
        className,
      )}
    >
      {/* Header - Context bar */}
      <div className="flex h-10 items-center border-b border-white/[0.03] px-4 select-none">
        <div className="flex items-center gap-2 text-white/50">
          <span className="text-[16px]">tan/dev/pi-desktop</span>
          <span className="text-white/20">›</span>
          <span className="text-[16px] text-white/70">frontend-design</span>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 select-text">
        {/* Message from user */}
        <div className="mb-4 flex gap-3">
          <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0">
            <span className="text-[14px] font-medium text-white">T</span>
          </div>
          <div className="flex-1">
            <div className="text-[16px] text-white/90 leading-relaxed font-regular">
              this is the textbox to interact with the llm. notice how skills
              and slash commands are highlighted and can be invoked with /
            </div>
          </div>
        </div>

        {/* Skills Dropdown - Cursor style */}
        <div className="mb-4 ml-9">
          <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#141414]/95 shadow-xl">
            <div className="border-b border-white/[0.04] px-3 py-2">
              <span className="text-[14px] font-medium text-white/40 uppercase tracking-wider">
                Skills
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              <SkillItem
                icon=""
                name="electron"
                description="Provides comprehensive guidan..."
                active
              />
              <SkillItem
                icon=""
                name="electron"
                description="Automate Electron desktop apps..."
              />
              <SkillItem
                icon=""
                name="agent-browser"
                description="Browser automation CLI fo..."
              />
              <SkillItem
                icon=""
                name="agent-md-refactor"
                description="Refactor bloated AGEN..."
              />
              <SkillItem
                icon=""
                name="ai-gateway"
                description="Vercel AI Gateway expert guidan..."
              />
              <SkillItem
                icon=""
                name="ai-sdk"
                description="Vercel AI SDK expert guidance. Us..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Input Area - Cursor Glass style */}
      <div className="p-4 select-none">
        <div
          className={cn(
            "relative overflow-hidden rounded-xl select-none",
            "border border-white/[0.06] bg-[#141414]/95",
            "transition-all duration-150",
            "focus-within:border-white/[0.12] focus-within:shadow-[0_0_0_1px_rgba(59,130,246,0.2)]",
          )}
        >
          {/* Slash command hint */}
          <div className="px-4 pt-3 pb-2 select-text">
            <span className="text-[16px] text-white/30 font-mono">/</span>
            <span className="text-[16px] text-amber-400/90">
              frontend-design
            </span>
            <span className="text-[16px] text-white/60 ml-1">
              this is the textbox to interact with the llm. notice how skills
              and slash commands are highlighted and can be invoked with /
            </span>
          </div>

          {/* Input toolbar */}
          <div className="flex items-center justify-between border-t border-white/[0.04] px-3 py-2 select-none">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
              >
                <Plus weight="bold" className="size-5" />
              </button>
              <div className="h-4 w-px bg-white/[0.06] mx-1" />
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
              >
                <Paperclip className="size-5" />
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
              >
                <At className="size-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[14px] text-white/30">Plan: N...</span>
              <button
                type="button"
                className="flex h-7 items-center gap-1.5 rounded-md bg-white text-black px-3 text-[14px] font-medium hover:bg-white/90 transition-colors"
              >
                <Star className="size-5" weight="fill" />
                Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillItem({
  icon: _icon,
  name,
  description,
  active,
}: {
  icon: string;
  name: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
      )}
    >
      <div className="flex size-5 items-center justify-center rounded text-white/50">
        <span className="text-[14px]">✦</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium text-white/90">{name}</span>
        </div>
        <div className="text-[14px] text-white/40 truncate">{description}</div>
      </div>
    </div>
  );
}

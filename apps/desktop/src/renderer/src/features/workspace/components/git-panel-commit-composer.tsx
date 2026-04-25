import * as React from "react";
import { Button } from "@/components/ui/button";
import { CaretDown } from "@/components/ui/phosphor-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  applyCommitTemplate,
  type CommitTemplate,
  DEFAULT_COMMIT_TEMPLATES,
} from "./git-panel-model";

export interface GitPanelCommitComposerProps {
  repositoryPath: string | null;
  commitMessage: string;
  isLoading: boolean;
  commitTemplates?: ReadonlyArray<CommitTemplate>;
  canCommit: boolean;
  canCommitAndPush: boolean;
  canPull: boolean;
  canPush: boolean;
  canFetch: boolean;
  amend: boolean;
  canAmend: boolean;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void | Promise<void>;
  onCommitAndPush: () => void | Promise<void>;
  onPull: () => void | Promise<void>;
  onPush: () => void | Promise<void>;
  onFetch: () => void | Promise<void>;
  onAmendChange?: (amend: boolean) => void;
}

export function GitPanelCommitComposer({
  repositoryPath,
  commitMessage,
  isLoading,
  commitTemplates = DEFAULT_COMMIT_TEMPLATES,
  canCommit,
  canCommitAndPush,
  canPull,
  canPush,
  canFetch,
  amend,
  canAmend,
  onCommitMessageChange,
  onCommit,
  onCommitAndPush,
  onPull,
  onPush,
  onFetch,
  onAmendChange,
}: GitPanelCommitComposerProps) {
  const handleApplyTemplate = React.useCallback(
    (template: CommitTemplate) => {
      onCommitMessageChange(applyCommitTemplate(commitMessage, template));
    },
    [commitMessage, onCommitMessageChange],
  );

  const handleToggleAmend = React.useCallback(() => {
    onAmendChange?.(!amend);
  }, [amend, onAmendChange]);

  return (
    <section>
      <textarea
        value={commitMessage}
        onChange={(event) => onCommitMessageChange(event.target.value)}
        placeholder="Commit message..."
        rows={2}
        disabled={!repositoryPath || isLoading}
        className="w-full resize-none bg-transparent px-0 py-2 text-[11px] leading-relaxed text-white/90 placeholder:text-white/55 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Insert commit template"
                disabled={!repositoryPath || isLoading}
                className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Template</span>
                <CaretDown className="size-2.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              className="w-40 border-white/10 bg-[var(--color-bg-tertiary)] p-1 shadow-2xl"
            >
              <div className="flex flex-col gap-0.5 max-h-56 overflow-auto custom-scrollbar">
                {commitTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApplyTemplate(template)}
                    className="justify-start px-2 py-1.5 text-[11px] font-mono text-white/60 hover:bg-white/[0.05] hover:text-white"
                  >
                    {template.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {canAmend ? (
            <label
              className={
                amend
                  ? "flex items-center gap-1.5 text-[11px] select-none cursor-pointer text-white/80"
                  : "flex items-center gap-1.5 text-[11px] select-none cursor-pointer text-white/40"
              }
            >
              <input
                type="checkbox"
                checked={amend}
                onChange={handleToggleAmend}
                aria-label="Amend previous commit"
                className="accent-[var(--color-accent)]"
              />
              <span>Amend</span>
            </label>
          ) : null}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={!canCommit || !commitMessage.trim() || isLoading}
            >
              <span>{amend ? "Amend" : "Commit"}</span>
              <CaretDown className="size-2.5 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            className="w-48 border-white/10 bg-[var(--color-bg-tertiary)] p-1 shadow-2xl"
          >
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={!canCommit || !commitMessage.trim() || isLoading}
                onClick={() => void onCommit()}
                className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
              >
                {amend ? "Amend" : "Commit"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  !canCommitAndPush || !commitMessage.trim() || isLoading
                }
                onClick={() => void onCommitAndPush()}
                className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
              >
                {amend ? "Amend & Push" : "Commit & Push"}
              </Button>
              <div className="my-1 h-px bg-white/5" />
              <Button
                variant="ghost"
                size="sm"
                disabled={!canPush || isLoading}
                onClick={() => void onPush()}
                className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
              >
                Push
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!canPull || isLoading}
                onClick={() => void onPull()}
                className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
              >
                Pull
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!canFetch || isLoading}
                onClick={() => void onFetch()}
                className="justify-start px-2 py-1.5 text-[11px] font-normal text-white/60 hover:bg-white/[0.05] hover:text-white"
              >
                Fetch
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}

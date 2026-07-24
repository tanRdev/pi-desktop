import type { MentionSuggestion, SlashSuggestion } from "@pi-desktop/shared";
import * as React from "react";
import { useStore } from "zustand";
import type { UiInteractionStore } from "@/stores/ui-interaction-store";
import type { ThreadConversationState } from "@/stores/workspace-session-store";
import {
  dispatchPiCommand,
  findBuiltInBySlash,
} from "./components/prompt-dock/slash-commands";
import type { WorkspaceShellProps } from "./components/workspace-shell";
import { loadPromptAutocompleteSuggestions } from "./prompt-autocomplete-loader";
import {
  buildFileMention,
  buildTerminalMention,
  getPromptAutocompleteMatch,
  parseOAuthChatCommand,
  planPromptDispatch,
  replacePromptToken,
} from "./prompt-routing";

const EMPTY_AUTOCOMPLETE_SUGGESTIONS: (SlashSuggestion | MentionSuggestion)[] =
  [];

export type PromptMode = "build" | "plan";

const PROMPT_MODE_TO_PREFIX = {
  build: "/skill:build ",
  plan: "/skill:plan ",
} satisfies Record<PromptMode, string>;

function stripPromptModePrefix(value: string): string {
  return value
    .replace(/^\/skill:(?:plan|build)\s+/i, "")
    .replace(/^\/(?:plan|build)\s+/i, "");
}

function detectPromptMode(value: string): PromptMode {
  if (/^\/skill:plan\b/i.test(value) || /^\/plan\b/i.test(value)) {
    return "plan";
  }

  return "build";
}

function isPromptExecutionVisible({
  activeThreadId,
  pendingPromptThreadId,
  conversation,
}: {
  activeThreadId: string | null;
  pendingPromptThreadId: string | null;
  conversation: ThreadConversationState | undefined;
}): boolean {
  return (
    conversation?.status === "streaming" ||
    (activeThreadId !== null && pendingPromptThreadId === activeThreadId)
  );
}

export interface UseWorkspacePromptOptions {
  draft: string;
  setDraft: (draft: string) => void;
  sendPrompt: (text?: string) => Promise<void>;
  cancelPrompt: () => Promise<void>;
  activeThreadId: string | null;
  activeThreadConversation: ThreadConversationState | undefined;
  agentStatus: string;
  activeWorktreePath: string | null;
  contextWindows: WorkspaceShellProps["contextWindows"];
  uiStore: UiInteractionStore;
  openOAuthDialog: (
    mode: "providers" | "login" | "logout",
    providerId: string | null,
  ) => Promise<void>;
}

export interface WorkspacePromptController {
  autocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  autocompleteSelectedIndex: number;
  canSend: boolean;
  isPromptExecuting: boolean;
  isPromptVisible: boolean;
  promptMode: PromptMode;
  handleSend: () => Promise<void>;
  handleRetryLastUserMessage: (text: string) => void;
  handleResubmitUserMessage: (messageId: string, nextText: string) => void;
  handleCancelPrompt: () => Promise<void>;
  handleAutocompleteSelect: (
    suggestion: SlashSuggestion | MentionSuggestion,
  ) => void;
  handleAutocompleteHover: (index: number) => void;
  handlePromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  handlePromptModeChange: (mode: PromptMode) => void;
  handleAgentGitAction: (prompt: string) => void;
}

export function useWorkspacePrompt({
  draft,
  setDraft,
  sendPrompt,
  cancelPrompt,
  activeThreadId,
  activeThreadConversation,
  agentStatus,
  activeWorktreePath,
  contextWindows,
  uiStore,
  openOAuthDialog,
}: UseWorkspacePromptOptions): WorkspacePromptController {
  const autocompleteSuggestions = useStore(
    uiStore,
    (storeState) =>
      storeState.promptAutocompleteSuggestions ??
      EMPTY_AUTOCOMPLETE_SUGGESTIONS,
  );
  const autocompleteSelectedIndex = useStore(
    uiStore,
    (storeState) => storeState.promptAutocompleteSelectedIndex,
  );
  const [promptMode, setPromptMode] = React.useState<PromptMode>(() =>
    detectPromptMode(draft),
  );
  const [pendingPromptThreadId, setPendingPromptThreadId] = React.useState<
    string | null
  >(null);

  const setAutocompleteSuggestions = React.useCallback(
    (suggestions: (SlashSuggestion | MentionSuggestion)[]) => {
      uiStore.getState().setPromptAutocomplete(suggestions);
    },
    [uiStore],
  );
  const handleAutocompleteHover = React.useCallback(
    (index: number) => {
      uiStore.getState().setPromptAutocompleteSelectedIndex(index);
    },
    [uiStore],
  );
  const clearAutocomplete = React.useCallback(() => {
    uiStore.getState().clearPromptAutocomplete();
  }, [uiStore]);

  React.useEffect(() => {
    setPromptMode(detectPromptMode(draft));
  }, [draft]);

  React.useEffect(() => {
    if (!pendingPromptThreadId) {
      return;
    }

    if (pendingPromptThreadId !== activeThreadId) {
      setPendingPromptThreadId(null);
      return;
    }

    const activeStatus = activeThreadConversation?.status ?? agentStatus;
    if (activeStatus !== "starting" && activeStatus !== "streaming") {
      setPendingPromptThreadId(null);
    }
  }, [
    activeThreadConversation?.status,
    activeThreadId,
    agentStatus,
    pendingPromptThreadId,
  ]);

  const canSend =
    draft.trim().length > 0 &&
    activeThreadId !== null &&
    agentStatus !== "starting" &&
    agentStatus !== "streaming";
  const isPromptExecuting = isPromptExecutionVisible({
    activeThreadId,
    pendingPromptThreadId,
    conversation: activeThreadConversation,
  });
  const isPromptVisible = activeThreadId !== null;

  const autocompleteMatch = React.useMemo(
    () => getPromptAutocompleteMatch(draft),
    [draft],
  );
  const contextWindowsKey = React.useMemo(
    () => JSON.stringify(contextWindows),
    [contextWindows],
  );
  const stableContextWindowsRef = React.useRef({
    key: contextWindowsKey,
    value: contextWindows,
  });

  if (stableContextWindowsRef.current.key !== contextWindowsKey) {
    stableContextWindowsRef.current = {
      key: contextWindowsKey,
      value: contextWindows,
    };
  }

  const stableContextWindows = stableContextWindowsRef.current.value;

  React.useEffect(() => {
    let disposed = false;

    async function loadAutocomplete() {
      if (!autocompleteMatch) {
        clearAutocomplete();
        return;
      }

      try {
        const suggestions = await loadPromptAutocompleteSuggestions({
          draft,
          autocompleteMatch,
          activeWorktreePath,
          windows: stableContextWindows,
          getSlashSuggestions: (args) =>
            window.piDesktop.agent.getSlashSuggestions(args),
          searchFiles: (args) => window.piDesktop.search.searchFiles(args),
        });

        if (!disposed) {
          setAutocompleteSuggestions(suggestions);
        }
      } catch (error) {
        console.error("Failed to load prompt autocomplete suggestions:", error);
        if (!disposed) {
          clearAutocomplete();
        }
      }
    }

    void loadAutocomplete();

    return () => {
      disposed = true;
    };
  }, [
    autocompleteMatch,
    activeWorktreePath,
    clearAutocomplete,
    stableContextWindows,
    draft,
    setAutocompleteSuggestions,
  ]);

  const handleAutocompleteSelect = React.useCallback(
    (suggestion: SlashSuggestion | MentionSuggestion) => {
      if (!autocompleteMatch) {
        return;
      }

      let replacement = "";
      if (suggestion.kind === "skill" || suggestion.kind === "command") {
        replacement = `${suggestion.slash} `;
      } else if (suggestion.kind === "terminal") {
        replacement = buildTerminalMention(suggestion.id);
      } else if (suggestion.kind === "file") {
        replacement = buildFileMention(suggestion.id);
      } else {
        replacement = `${suggestion.name} `;
      }

      setDraft(replacePromptToken(draft, autocompleteMatch, replacement));
      clearAutocomplete();
    },
    [autocompleteMatch, clearAutocomplete, draft, setDraft],
  );

  const handleCancelPrompt = React.useCallback(async () => {
    setPendingPromptThreadId(null);
    await cancelPrompt();
  }, [cancelPrompt]);

  const handlePromptKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        if (autocompleteMatch && autocompleteSuggestions.length > 0) {
          event.preventDefault();
          clearAutocomplete();
          return;
        }
        if (isPromptExecuting) {
          event.preventDefault();
          void handleCancelPrompt();
        }
        return;
      }

      if (!autocompleteMatch || autocompleteSuggestions.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (autocompleteSelectedIndex < autocompleteSuggestions.length - 1) {
          handleAutocompleteHover(autocompleteSelectedIndex + 1);
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (autocompleteSelectedIndex > 0) {
          handleAutocompleteHover(autocompleteSelectedIndex - 1);
        }
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        const selectedSuggestion =
          autocompleteSelectedIndex >= 0
            ? autocompleteSuggestions[autocompleteSelectedIndex]
            : undefined;
        if (selectedSuggestion) {
          event.preventDefault();
          handleAutocompleteSelect(selectedSuggestion);
        }
      }
    },
    [
      autocompleteMatch,
      autocompleteSelectedIndex,
      autocompleteSuggestions,
      clearAutocomplete,
      handleAutocompleteHover,
      handleAutocompleteSelect,
      handleCancelPrompt,
      isPromptExecuting,
    ],
  );

  const handleSend = React.useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    const oauthCommand = parseOAuthChatCommand(trimmed);
    if (oauthCommand) {
      setDraft("");
      if (oauthCommand.action === "providers") {
        await openOAuthDialog("providers", null);
        return;
      }

      await openOAuthDialog(oauthCommand.action, oauthCommand.providerId);
      return;
    }

    const builtinSlash = trimmed.split(/\s+/, 1)[0] ?? "";
    const builtin = findBuiltInBySlash(builtinSlash);
    if (builtin && trimmed === builtin.slash) {
      setDraft("");
      clearAutocomplete();
      dispatchPiCommand(builtin);
      return;
    }

    if (!canSend || !activeThreadId) {
      return;
    }

    const plan = planPromptDispatch({
      draft: trimmed,
      canSend: true,
      activeThreadId,
    });

    if (plan.action === "noop") {
      return;
    }

    if (plan.action === "route") {
      // Terminal routing: write into the terminal session and clear the dock.
      setDraft("");
      try {
        window.piDesktop.terminal.write(plan.terminalId, `${plan.prompt}\n`);
      } catch (error) {
        console.error("Failed to route prompt to terminal:", error);
        setDraft(trimmed);
      }
      return;
    }

    setPendingPromptThreadId(activeThreadId);
    clearAutocomplete();
    // Expand @file: mentions before sending; clear chips via custom event.
    window.dispatchEvent(new CustomEvent("pi:prompt-sent"));
    await sendPrompt(plan.nextDraft);
  }, [
    activeThreadId,
    canSend,
    clearAutocomplete,
    draft,
    openOAuthDialog,
    sendPrompt,
    setDraft,
  ]);

  const handleRetryLastUserMessage = React.useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (
        !trimmed ||
        !activeThreadId ||
        agentStatus === "starting" ||
        agentStatus === "streaming"
      ) {
        return;
      }

      setPendingPromptThreadId(activeThreadId);
      void sendPrompt(trimmed);
    },
    [activeThreadId, agentStatus, sendPrompt],
  );

  const handleResubmitUserMessage = React.useCallback(
    (messageId: string, nextText: string) => {
      const trimmed = nextText.trim();
      if (
        !trimmed ||
        !messageId ||
        !activeThreadId ||
        agentStatus === "starting" ||
        agentStatus === "streaming"
      ) {
        return;
      }

      setPendingPromptThreadId(activeThreadId);
      void sendPrompt(trimmed);
    },
    [activeThreadId, agentStatus, sendPrompt],
  );

  const handlePromptModeChange = React.useCallback(
    (nextMode: PromptMode) => {
      setPromptMode(nextMode);
      const normalizedDraft = stripPromptModePrefix(draft).trimStart();
      const prefix = PROMPT_MODE_TO_PREFIX[nextMode];
      setDraft(
        `${prefix}${normalizedDraft}`.trimEnd() + (normalizedDraft ? "" : ""),
      );
    },
    [draft, setDraft],
  );

  const handleAgentGitAction = React.useCallback(
    (prompt: string) => {
      if (
        !activeThreadId ||
        agentStatus === "starting" ||
        agentStatus === "streaming"
      ) {
        return;
      }
      setPendingPromptThreadId(activeThreadId);
      void sendPrompt(prompt);
    },
    [activeThreadId, agentStatus, sendPrompt],
  );

  return {
    autocompleteSuggestions,
    autocompleteSelectedIndex,
    canSend,
    isPromptExecuting,
    isPromptVisible,
    promptMode,
    handleSend,
    handleRetryLastUserMessage,
    handleResubmitUserMessage,
    handleCancelPrompt,
    handleAutocompleteSelect,
    handleAutocompleteHover,
    handlePromptKeyDown,
    handlePromptModeChange,
    handleAgentGitAction,
  };
}

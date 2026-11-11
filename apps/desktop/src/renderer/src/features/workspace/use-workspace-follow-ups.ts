import type {
  FollowUpQueueState,
  PromptImageAttachment,
} from "@pi-desktop/shared";
import * as React from "react";
import type { FollowUpDockProps } from "./components/prompt-dock";
import { loadPromptImageAttachments } from "./prompt-image-attachments";
import { expandFileMentions } from "./prompt-routing";

/**
 * Follow-up queue + steer handlers for the workspace prompt (issue #10).
 * Split out of use-workspace-prompt so the queue operations stay in one
 * place; the returned `followUpProps` bundle is what the shell layers
 * forward to the prompt dock.
 */
/**
 * The follow-up wiring the workspace prompt accepts from the shell model
 * (issue #10). Optional so isolated prompt tests need no queue.
 */
export interface WorkspaceFollowUpWiring {
  enqueueFollowUp?: (
    text: string,
    images?: PromptImageAttachment[],
  ) => string | null;
  steerPrompt?: (
    text: string,
    images?: PromptImageAttachment[],
  ) => Promise<void>;
  followUpQueue?: FollowUpQueueState;
  supportsSteer?: boolean;
  editFollowUp?: (threadId: string, itemId: string, text: string) => void;
  deleteFollowUp?: (threadId: string, itemId: string) => void;
  moveFollowUp?: (threadId: string, itemId: string, offset: -1 | 1) => void;
  setFollowUpPaused?: (threadId: string, paused: boolean) => void;
  retryFollowUp?: (threadId: string, itemId: string) => void;
}

export interface UseWorkspaceFollowUpsOptions extends WorkspaceFollowUpWiring {
  activeThreadId: string | null;
  draft: string;
  isPromptExecuting: boolean;
  setDraft: (draft: string) => void;
  clearAutocomplete: () => void;
}

export interface WorkspaceFollowUps {
  followUpQueue: FollowUpQueueState | undefined;
  supportsSteer: boolean;
  handleSteer: () => Promise<void>;
  handleSteerFollowUp: (itemId: string) => Promise<void>;
  handleEditFollowUp: (itemId: string, text: string) => void;
  handleDeleteFollowUp: (itemId: string) => void;
  handleMoveFollowUp: (itemId: string, offset: -1 | 1) => void;
  handleToggleFollowUpPaused: () => void;
  handleRetryFollowUp: (itemId: string) => void;
  followUpProps: FollowUpDockProps;
}

export function useWorkspaceFollowUps({
  activeThreadId,
  draft,
  isPromptExecuting,
  setDraft,
  clearAutocomplete,
  steerPrompt,
  followUpQueue,
  supportsSteer = false,
  editFollowUp,
  deleteFollowUp,
  moveFollowUp,
  setFollowUpPaused,
  retryFollowUp,
}: UseWorkspaceFollowUpsOptions): WorkspaceFollowUps {
  const handleSteer = React.useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || !activeThreadId || !supportsSteer || !steerPrompt) {
      return;
    }
    if (!isPromptExecuting) {
      return;
    }

    const images = await loadPromptImageAttachments(draft);
    const text = expandFileMentions(draft);
    if (images.length > 0) {
      await steerPrompt(text, images);
    } else {
      await steerPrompt(text);
    }
    setDraft("");
    clearAutocomplete();
  }, [
    activeThreadId,
    clearAutocomplete,
    draft,
    isPromptExecuting,
    setDraft,
    steerPrompt,
    supportsSteer,
  ]);

  const handleSteerFollowUp = React.useCallback(
    async (itemId: string) => {
      if (!activeThreadId || !supportsSteer || !steerPrompt || !followUpQueue) {
        return;
      }
      const item = followUpQueue.items.find((entry) => entry.id === itemId);
      if (!item || (item.status !== "queued" && item.status !== "failed")) {
        return;
      }
      // Remove first so the dispatcher cannot also deliver it.
      deleteFollowUp?.(activeThreadId, itemId);
      if (item.images.length > 0) {
        await steerPrompt(item.text, [...item.images]);
      } else {
        await steerPrompt(item.text);
      }
    },
    [activeThreadId, deleteFollowUp, followUpQueue, steerPrompt, supportsSteer],
  );

  const handleEditFollowUp = React.useCallback(
    (itemId: string, text: string) => {
      if (activeThreadId) {
        editFollowUp?.(activeThreadId, itemId, text);
      }
    },
    [activeThreadId, editFollowUp],
  );

  const handleDeleteFollowUp = React.useCallback(
    (itemId: string) => {
      if (activeThreadId) {
        deleteFollowUp?.(activeThreadId, itemId);
      }
    },
    [activeThreadId, deleteFollowUp],
  );

  const handleMoveFollowUp = React.useCallback(
    (itemId: string, offset: -1 | 1) => {
      if (activeThreadId) {
        moveFollowUp?.(activeThreadId, itemId, offset);
      }
    },
    [activeThreadId, moveFollowUp],
  );

  const handleToggleFollowUpPaused = React.useCallback(() => {
    if (activeThreadId) {
      setFollowUpPaused?.(activeThreadId, !(followUpQueue?.paused ?? false));
    }
  }, [activeThreadId, followUpQueue?.paused, setFollowUpPaused]);

  const handleRetryFollowUp = React.useCallback(
    (itemId: string) => {
      if (activeThreadId) {
        retryFollowUp?.(activeThreadId, itemId);
      }
    },
    [activeThreadId, retryFollowUp],
  );

  const followUpProps = React.useMemo<FollowUpDockProps>(
    () => ({
      followUpQueue,
      supportsSteer,
      onSteer: handleSteer,
      onEditFollowUp: handleEditFollowUp,
      onDeleteFollowUp: handleDeleteFollowUp,
      onMoveFollowUp: handleMoveFollowUp,
      onToggleFollowUpPaused: handleToggleFollowUpPaused,
      onRetryFollowUp: handleRetryFollowUp,
      onSteerFollowUp: handleSteerFollowUp,
    }),
    [
      followUpQueue,
      handleDeleteFollowUp,
      handleEditFollowUp,
      handleMoveFollowUp,
      handleRetryFollowUp,
      handleSteer,
      handleSteerFollowUp,
      handleToggleFollowUpPaused,
      supportsSteer,
    ],
  );

  return {
    followUpQueue,
    supportsSteer,
    handleSteer,
    handleSteerFollowUp,
    handleEditFollowUp,
    handleDeleteFollowUp,
    handleMoveFollowUp,
    handleToggleFollowUpPaused,
    handleRetryFollowUp,
    followUpProps,
  };
}

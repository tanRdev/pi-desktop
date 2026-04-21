import type { GitRepositoryStatus } from "@pi-desktop/shared";
import * as React from "react";
import { toast } from "@/lib/toast";

function getGitErrorDescription(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown git error";
}

export interface WorkspaceGitController {
  activeGitRepositoryStatus: GitRepositoryStatus | null;
  gitCommitMessage: string;
  setGitCommitMessage: (value: string) => void;
  refreshGitRepositoryStatus: () => Promise<void>;
  stageGitFile: (filePath: string) => Promise<void>;
  stageAllGitFiles: (filePaths: string[]) => Promise<void>;
  unstageGitFile: (filePath: string) => Promise<void>;
  unstageAllGitFiles: (filePaths: string[]) => Promise<void>;
  discardGitFile: (filePath: string) => Promise<void>;
  commitGitChanges: () => Promise<void>;
  commitAndPushGitChanges: () => Promise<void>;
  pullGitChanges: () => Promise<void>;
  pushGitChanges: () => Promise<void>;
  fetchGitChanges: () => Promise<void>;
}

export interface UseWorkspaceGitOptions {
  activeWorktreePath: string | null;
  reload: () => Promise<void>;
}

export function useWorkspaceGit({
  activeWorktreePath,
  reload,
}: UseWorkspaceGitOptions): WorkspaceGitController {
  const [activeGitRepositoryStatus, setActiveGitRepositoryStatus] =
    React.useState<GitRepositoryStatus | null>(null);
  const [gitCommitMessage, setGitCommitMessageState] = React.useState("");

  const setGitCommitMessage = React.useCallback((value: string) => {
    setGitCommitMessageState(value);
  }, []);

  const loadGitRepositoryStatus = React.useCallback(
    async (options: { force?: boolean; reloadShell?: boolean } = {}) => {
      if (!activeWorktreePath) {
        setActiveGitRepositoryStatus(null);
        return null;
      }

      const statusPromise = window.piDesktop.git.getRepositoryStatus(
        activeWorktreePath,
        options.force ? { force: true } : undefined,
      );

      const [status] = await Promise.all([
        statusPromise,
        options.reloadShell ? reload() : Promise.resolve(),
      ]);

      setActiveGitRepositoryStatus(status);
      return status;
    },
    [activeWorktreePath, reload],
  );

  const refreshGitRepositoryStatus = React.useCallback(async () => {
    await loadGitRepositoryStatus({ force: true, reloadShell: true });
  }, [loadGitRepositoryStatus]);

  React.useEffect(() => {
    let disposed = false;

    if (!activeWorktreePath) {
      setActiveGitRepositoryStatus(null);
      return;
    }

    void loadGitRepositoryStatus().catch(() => {
      if (!disposed) {
        setActiveGitRepositoryStatus(null);
      }
    });

    return () => {
      disposed = true;
    };
  }, [activeWorktreePath, loadGitRepositoryStatus]);

  const runGitMutation = React.useCallback(
    async (
      operation: () => Promise<GitRepositoryStatus>,
      successMessage: string,
    ) => {
      try {
        const status = await operation();
        setActiveGitRepositoryStatus(status);
        toast.success(successMessage);
        await reload();
      } catch (error) {
        toast.error("Git action failed", {
          description: getGitErrorDescription(error),
        });
      }
    },
    [reload],
  );

  const stageGitFile = React.useCallback(
    async (filePath: string) => {
      if (!activeWorktreePath) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.stageFile(activeWorktreePath, filePath),
        "File staged",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const stageAllGitFiles = React.useCallback(
    async (filePaths: string[]) => {
      if (!activeWorktreePath || filePaths.length === 0) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.stageFiles(activeWorktreePath, filePaths),
        "Files staged",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const unstageGitFile = React.useCallback(
    async (filePath: string) => {
      if (!activeWorktreePath) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.unstageFile(activeWorktreePath, filePath),
        "File unstaged",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const unstageAllGitFiles = React.useCallback(
    async (filePaths: string[]) => {
      if (!activeWorktreePath || filePaths.length === 0) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.unstageFiles(activeWorktreePath, filePaths),
        "Files unstaged",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const discardGitFile = React.useCallback(
    async (filePath: string) => {
      if (!activeWorktreePath) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.discardFile(activeWorktreePath, filePath),
        "Changes discarded",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const commitGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath || !gitCommitMessage.trim()) {
      return;
    }

    try {
      const status = await window.piDesktop.git.commit(
        activeWorktreePath,
        gitCommitMessage,
      );
      setActiveGitRepositoryStatus(status);
      setGitCommitMessageState("");
      toast.success("Commit created");
      await reload();
    } catch (error) {
      toast.error("Commit failed", {
        description: getGitErrorDescription(error),
      });
    }
  }, [activeWorktreePath, gitCommitMessage, reload]);

  const commitAndPushGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath || !gitCommitMessage.trim()) {
      return;
    }

    try {
      await window.piDesktop.git.commit(activeWorktreePath, gitCommitMessage);
      const status = await window.piDesktop.git.push(activeWorktreePath);
      setActiveGitRepositoryStatus(status);
      setGitCommitMessageState("");
      toast.success("Committed and pushed");
      await reload();
    } catch (error) {
      toast.error("Commit & Push failed", {
        description: getGitErrorDescription(error),
      });
    }
  }, [activeWorktreePath, gitCommitMessage, reload]);

  const pullGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath) {
      return;
    }

    await runGitMutation(
      () => window.piDesktop.git.pull(activeWorktreePath),
      "Repository updated",
    );
  }, [activeWorktreePath, runGitMutation]);

  const pushGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath) {
      return;
    }

    await runGitMutation(
      () => window.piDesktop.git.push(activeWorktreePath),
      "Changes pushed",
    );
  }, [activeWorktreePath, runGitMutation]);

  const fetchGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath) {
      return;
    }

    await runGitMutation(
      () => window.piDesktop.git.fetch(activeWorktreePath),
      "Repository fetched",
    );
  }, [activeWorktreePath, runGitMutation]);

  return {
    activeGitRepositoryStatus,
    gitCommitMessage,
    setGitCommitMessage,
    refreshGitRepositoryStatus,
    stageGitFile,
    stageAllGitFiles,
    unstageGitFile,
    unstageAllGitFiles,
    discardGitFile,
    commitGitChanges,
    commitAndPushGitChanges,
    pullGitChanges,
    pushGitChanges,
    fetchGitChanges,
  };
}

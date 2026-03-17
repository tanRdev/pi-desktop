import { describe, expect, it } from "vitest";

describe("bootstrap helpers (RED) - dynamic imports for future modules", () => {
  describe("routePromptToTerminal (route-to-terminal)", () => {
    it("rejects empty prompt after trimming and trims non-empty prompts", async () => {
      const mod = await import(
        "../../../apps/desktop/src/main/bootstrap/route-to-terminal"
      );
      const { routePromptToTerminal } = mod as any;

      const sessions = [
        { id: "term-1", backend: "bash", linkedThreadId: "thread-1" },
      ];

      let writes: Array<{ id: string; data: string }> = [];
      const deps = {
        getSessions: () => sessions,
        write: (id: string, data: string) => writes.push({ id, data }),
        delay: (ms: number) => Promise.resolve(),
      } as const;

      // empty after trim -> error
      // signature: routePromptToTerminal(request, deps)
      const empty = await routePromptToTerminal(
        { terminalId: "term-1", prompt: "   " },
        deps,
      );
      expect(empty).toEqual({
        success: false,
        error: "Prompt must not be empty",
      });

      // trims prompt and writes prompt + "\n"
      writes = [];
      const ok = await routePromptToTerminal(
        { terminalId: "term-1", prompt: "  hello world  " },
        deps,
      );
      expect(ok && ok.success).toBe(true);
      expect(writes.length).toBeGreaterThanOrEqual(1);
      expect(writes[0]).toEqual({ id: "term-1", data: "hello world\n" });
    });

    it("returns error for unknown terminal and rejects lazygit backends", async () => {
      const mod = await import(
        "../../../apps/desktop/src/main/bootstrap/route-to-terminal"
      );
      const { routePromptToTerminal } = mod as any;

      const depsEmpty = {
        getSessions: () => [],
        write: (_: string, __: string) => {},
        delay: (_: number) => Promise.resolve(),
      } as const;

      const unknown = await routePromptToTerminal(
        { terminalId: "no-such", prompt: "hi" },
        depsEmpty,
      );
      expect(unknown).toEqual({
        success: false,
        error: `Unknown terminal session: no-such`,
      });

      const depsLazy = {
        getSessions: () => [{ id: "lg", backend: "lazygit" }],
        write: (_: string, __: string) => {},
        delay: (_: number) => Promise.resolve(),
      } as const;

      const lazy = await routePromptToTerminal(
        { terminalId: "lg", prompt: "status" },
        depsLazy,
      );
      expect(lazy).toEqual({
        success: false,
        error: "Cannot route prompts into a lazygit session",
      });
    });

    it("when startPiIfNotLinked is true and no linkedThreadId, writes pi then the prompt", async () => {
      const mod = await import(
        "../../../apps/desktop/src/main/bootstrap/route-to-terminal"
      );
      const { routePromptToTerminal } = mod as any;

      const writes: Array<{ id: string; data: string }> = [];
      const delays: number[] = [];
      const deps = {
        getSessions: () => [{ id: "term-2", backend: "bash" }],
        write: (id: string, data: string) => writes.push({ id, data }),
        delay: (ms: number) => {
          delays.push(ms);
          return Promise.resolve();
        },
      } as const;

      const res = await routePromptToTerminal(
        { terminalId: "term-2", prompt: " run-me ", startPiIfNotLinked: true },
        deps,
      );
      expect(res && res.success).toBe(true);
      // should have written 'pi\n' first then the trimmed prompt + \n

      expect(writes[0]).toEqual({ id: "term-2", data: "pi\n" });
      expect(writes[1]).toEqual({ id: "term-2", data: "run-me\n" });
      expect(delays).toContain(150);
    });
  });

  describe("switchModelForContext (model-switch)", () => {
    it("throws when there is no active context", async () => {
      const mod = await import(
        "../../../apps/desktop/src/main/bootstrap/model-switch"
      );
      const { switchModelForContext } = mod as any;

      const deps = {
        currentContext: null,
        resolveAgentDirectory: () => "agent-dir",
        createSettingsManager: async (
          _worktreePath: string,
          _agentDir: string,
        ) => ({
          setDefaultProvider: (_: string) => {},
          setDefaultModel: (_: string) => {},
        }),
        restartThreadRuntime: async (_: any) => {},
        attachContext: async (_: any) => ({}),
        commitAttachment: (_: any) => {},
      } as const;

      await expect(
        switchModelForContext({ providerId: "p", modelId: "m" }, deps),
      ).rejects.toThrow("No active Pi context is selected");
    });

    it("creates settings manager, sets provider/model, restarts runtime and commits attachment", async () => {
      const mod = await import(
        "../../../apps/desktop/src/main/bootstrap/model-switch"
      );
      const { switchModelForContext } = mod as any;

      const currentContext = {
        worktreePath: "/repo/worktree",
        thread: { id: "thread-42" },
        command: ["/bin/run"],
        agentDirectory: null,
      } as const;

      let created: {
        worktreePath?: string;
        agentDirectory?: string | null;
      } | null = null;
      let providerSet: string | null = null;
      let modelSet: string | null = null;
      let restarted: any = null;
      let attached: any = { attached: true };
      let committed: any = null;

      const deps = {
        currentContext,
        resolveAgentDirectory: () => "/resolved/agent",
        createSettingsManager: async (
          worktreePath: string,
          agentDirectory: string | null,
        ) => {
          created = { worktreePath, agentDirectory };
          return {
            setDefaultProvider: (id: string) => {
              providerSet = id;
            },
            setDefaultModel: (id: string) => {
              modelSet = id;
            },
          };
        },
        restartThreadRuntime: async (args: any) => {
          restarted = args;
        },
        attachContext: async (ctx: any) => {
          // emulate returning an attachment
          attached = { ctx };
          return attached;
        },
        commitAttachment: (a: any) => {
          committed = a;
        },
      } as const;

      const req = { providerId: "prov-x", modelId: "mod-y" };
      const res = await switchModelForContext(req, deps);

      // expectations per contract
      expect(created).not.toBeNull();
      expect(created!.worktreePath).toBe(currentContext.worktreePath);
      expect(providerSet).toBe(req.providerId);
      expect(modelSet).toBe(req.modelId);
      expect(restarted).not.toBeNull();
      expect(restarted.threadId).toBe(currentContext.thread.id);
      expect(committed).toBe(attached);
      // success should be truthy (implementation detail may vary)
      expect(res).toBeDefined();
    });
  });

  describe("buildThreadContext (thread-context)", () => {
    it("builds launch details, updates selection, creates agent dir when present and returns consolidated context", async () => {
      const mod = await import(
        "../../../apps/desktop/src/main/bootstrap/thread-context"
      );
      const { buildThreadContext } = mod as any;

      const options: any = {};
      options.repositoryId = "repo-007";
      options.inspection = { currentWorktreePath: "/repo/wt" };
      options.thread = { id: "thread-007", title: "T" };

      let lastSelectedArgs: any = null;
      options.repositoryCatalog = {
        setLastSelectedWorktree: (repositoryId: string, worktreeId: string) => {
          lastSelectedArgs = { repositoryId, worktreeId };
        },
      };

      let replacedSelection: any = null;
      options.selectionState = {
        replace: (selection: {
          repositoryId: string;
          worktreeId: string;
          threadId: string;
        }) => {
          replacedSelection = selection;
        },
      };

      const runtimeOptions = { mode: "mock", agentDir: "/tmp/agentdir" };
      let resolvedEnv: any = null;
      options.resolveAgentRuntimeOptions = (
        env: NodeJS.ProcessEnv,
        worktreePath: string,
      ) => {
        resolvedEnv = { env, worktreePath };
        return runtimeOptions;
      };

      let launchArgs: any = null;
      const launchDetails = {
        socketPath: "/tmp/sock",
        sessionName: "sess-1",
        command: ["run"],
      };
      options.createThreadRuntimeLaunchDetails = (args: any) => {
        launchArgs = args;
        return launchDetails;
      };

      const mkdirCalls: Array<{ path: string; options: any }> = [];
      options.mkdirSync = (path: string, options: { recursive: true }) =>
        mkdirCalls.push({ path, options });

      options.runtimeSocketDirectory = "/var/run/pidesk/sockets";
      options.execPath = "/usr/bin/node";
      options.sessionServerEntryPath = "/app/session-server";
      options.env = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

      const result = await buildThreadContext(options);

      expect(lastSelectedArgs).toEqual({
        repositoryId: options.repositoryId,
        worktreeId: options.inspection.currentWorktreePath,
      });
      expect(replacedSelection).toEqual({
        repositoryId: options.repositoryId,
        worktreeId: options.inspection.currentWorktreePath,
        threadId: options.thread.id,
      });
      expect(resolvedEnv).not.toBeNull();
      expect(mkdirCalls.length).toBeGreaterThanOrEqual(1);
      expect(mkdirCalls[0].path).toBe(runtimeOptions.agentDir);
      expect(launchArgs).not.toBeNull();
      expect(result).toMatchObject({
        repositoryId: options.repositoryId,
        worktreePath: options.inspection.currentWorktreePath,
        thread: options.thread,
        socketPath: launchDetails.socketPath,
        sessionName: launchDetails.sessionName,
        command: launchDetails.command,
        agentMode: runtimeOptions.mode,
        agentDirectory: runtimeOptions.agentDir,
      });
    });
  });
});

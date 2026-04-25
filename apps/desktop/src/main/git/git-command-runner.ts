import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";

export type GitCommandResult = {
  status: number;
  stdout: string;
  stderr: string;
  error: Error | null;
};

export type RunGit = (cwd: string, args: string[]) => GitCommandResult;

export type RunGitAsync = (
  cwd: string,
  args: string[],
) => Promise<GitCommandResult>;

type GitCommandResultInput = {
  status?: number | null;
  stdout?: string | ArrayBufferView | null;
  stderr?: string | ArrayBufferView | null;
  error?: Error | null;
};

type ExecFileErrorResultInput = {
  status?: number | null;
  stdout?: string | ArrayBufferView | null;
  stderr?: string | ArrayBufferView | null;
};

const execFileAsync = promisify(execFile);

export function normalizeGitCommandResult(
  result: GitCommandResultInput,
): GitCommandResult {
  return {
    status: result.status ?? 1,
    stdout: normalizeGitCommandOutput(result.stdout),
    stderr: normalizeGitCommandOutput(result.stderr),
    error: result.error ?? null,
  };
}

export function createExecFileErrorResult(
  error: ExecFileErrorResultInput,
): GitCommandResult {
  return {
    status: error.status ?? 1,
    stdout: normalizeGitCommandOutput(error.stdout),
    stderr: normalizeGitCommandOutput(error.stderr),
    error: null,
  };
}

export function createGitCommandErrorResult(error: unknown): GitCommandResult {
  return {
    status: 1,
    stdout: "",
    stderr: "",
    error: error instanceof Error ? error : new Error(String(error)),
  };
}

export function runGitCommand(cwd: string, args: string[]): GitCommandResult {
  try {
    return normalizeGitCommandResult(
      spawnSync("git", args, {
        cwd,
        encoding: "utf8",
      }),
    );
  } catch (error: unknown) {
    return createGitCommandErrorResult(error);
  }
}

export async function runGitCommandAsync(
  cwd: string,
  args: string[],
): Promise<GitCommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
    });

    return normalizeGitCommandResult({
      status: 0,
      stdout,
      stderr,
      error: null,
    });
  } catch (error: unknown) {
    if (isExecFileErrorResult(error)) {
      return createExecFileErrorResult(error);
    }

    return createGitCommandErrorResult(error);
  }
}

function normalizeGitCommandOutput(
  output: string | ArrayBufferView | null | undefined,
): string {
  if (typeof output === "string") {
    return output;
  }

  if (output && ArrayBuffer.isView(output)) {
    return Buffer.from(
      output.buffer,
      output.byteOffset,
      output.byteLength,
    ).toString("utf8");
  }

  return "";
}

function isExecFileErrorResult(
  error: unknown,
): error is ExecFileErrorResultInput {
  return error !== null && typeof error === "object" && "status" in error;
}

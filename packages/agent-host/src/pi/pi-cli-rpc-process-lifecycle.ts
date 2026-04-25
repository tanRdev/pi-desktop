import type { Writable } from "node:stream";

import { consumeJsonLines } from "./pi-cli-rpc-framing.js";
import { createExitError } from "./pi-cli-rpc-protocol.js";

type ChildProcessLike = {
  stdin: Writable;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  on(event: "error", listener: (error: Error) => void): ChildProcessLike;
  on(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): ChildProcessLike;
  kill(signal?: NodeJS.Signals | number): boolean;
};

type AttachCliRpcProcessLifecycleInput = {
  childProcess: ChildProcessLike;
  piCommand: string;
  handleLine(line: string): void;
  handleProcessFailure(error: Error): void;
};

function createProcessStartError(piCommand: string, error: Error): Error {
  const isEnoent =
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "ENOENT";

  if (!isEnoent) {
    return error;
  }

  return new Error(
    `Could not find the 'pi' CLI (tried: ${piCommand}). ` +
      "Make sure 'pi' is installed and accessible, or set the PI_CLI_PATH environment variable.",
  );
}

export function attachCliRpcProcessLifecycle({
  childProcess,
  piCommand,
  handleLine,
  handleProcessFailure,
}: AttachCliRpcProcessLifecycleInput): void {
  childProcess.stdout?.setEncoding?.("utf8");
  childProcess.stderr?.setEncoding?.("utf8");

  let stdoutBuffer = "";
  childProcess.stdout?.on("data", (chunk: string | Buffer) => {
    const framed = consumeJsonLines(stdoutBuffer, chunk.toString());
    stdoutBuffer = framed.remainder;

    for (const line of framed.lines) {
      handleLine(line);
    }
  });

  childProcess.on("error", (error) => {
    handleProcessFailure(createProcessStartError(piCommand, error));
  });

  childProcess.on("close", (code, signal) => {
    handleProcessFailure(createExitError(code, signal));
  });
}

export type { AttachCliRpcProcessLifecycleInput, ChildProcessLike };

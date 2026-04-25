import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { attachCliRpcProcessLifecycle } from "./pi-cli-rpc-process-lifecycle.js";
import { createExitError } from "./pi-cli-rpc-protocol.js";

class TestChildProcess extends EventEmitter {
  readonly stdin = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  readonly stdout = new PassThrough();

  readonly stderr = new PassThrough();

  kill(): boolean {
    return true;
  }
}

describe("attachCliRpcProcessLifecycle", () => {
  it("frames stdout lines and forwards process failures", async () => {
    const child = new TestChildProcess();
    const handleLine = vi.fn();
    const handleProcessFailure = vi.fn();

    attachCliRpcProcessLifecycle({
      childProcess: child,
      piCommand: "pi",
      handleLine,
      handleProcessFailure,
    });

    child.stdout.write('{"type":"one"}\n{"type":"tw');
    child.stdout.write('o"}\n');

    expect(handleLine).toHaveBeenNthCalledWith(1, '{"type":"one"}');
    expect(handleLine).toHaveBeenNthCalledWith(2, '{"type":"two"}');

    const enoentError = new Error("spawn pi ENOENT");
    Object.assign(enoentError, { code: "ENOENT" });
    child.emit("error", enoentError);

    expect(handleProcessFailure).toHaveBeenNthCalledWith(
      1,
      new Error(
        "Could not find the 'pi' CLI (tried: pi). Make sure 'pi' is installed and accessible, or set the PI_CLI_PATH environment variable.",
      ),
    );

    child.emit("close", 9, null);

    expect(handleProcessFailure).toHaveBeenNthCalledWith(
      2,
      createExitError(9, null),
    );
  });
});

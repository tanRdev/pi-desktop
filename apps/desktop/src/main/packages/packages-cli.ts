import { spawn } from "node:child_process";

export interface PackagesCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class PackagesCli {
  run(args: string[], cwd: string): Promise<PackagesCliResult> {
    return new Promise((resolve, reject) => {
      const child = spawn("pi", args, {
        cwd,
        env: process.env,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (exitCode) => {
        resolve({
          exitCode: exitCode ?? 1,
          stdout,
          stderr,
        });
      });
    });
  }
}

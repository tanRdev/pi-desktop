import { spawn } from "node:child_process";
import { buildEnhancedPath, resolvePiPathOrThrow } from "../resolve-pi-path";

export interface PackagesCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class PackagesCli {
  run(args: string[], cwd: string): Promise<PackagesCliResult> {
    return new Promise((resolve, reject) => {
      const piPath = resolvePiPathOrThrow();
      const child = spawn(piPath, args, {
        cwd,
        env: { ...process.env, PATH: buildEnhancedPath() },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        const isEnoent =
          "code" in error && (error as { code: string }).code === "ENOENT";
        if (isEnoent) {
          reject(
            new Error(
              `Could not find the 'pi' CLI at '${piPath}'. ` +
                "Make sure 'pi' is installed and accessible, or set the PI_CLI_PATH environment variable.",
            ),
          );
          return;
        }
        reject(error);
      });
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

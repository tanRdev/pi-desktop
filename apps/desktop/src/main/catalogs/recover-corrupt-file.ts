import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import {
  decodeVersionedEnvelope,
  type VersionedDecodeOptions,
} from "@pi-desktop/shared";

export function recoverCorruptFile<T>(
  filePath: string,
  catalogName: string,
  options: VersionedDecodeOptions<T>,
): void {
  if (!existsSync(filePath)) return;

  let rawText: string;
  try {
    rawText = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    quarantine(filePath, rawText, catalogName, "unparseable JSON");
    return;
  }

  const result = decodeVersionedEnvelope<T>(parsed, options);

  if (!result.ok) {
    quarantine(
      filePath,
      rawText,
      catalogName,
      `envelope decode failed: ${result.reason}`,
    );
  }
}

function quarantine(
  filePath: string,
  rawText: string,
  catalogName: string,
  reason: string,
): void {
  const siblingPath = `${filePath}.corrupt-${Date.now()}.json`;
  try {
    try {
      renameSync(filePath, siblingPath);
    } catch {
      writeFileSync(siblingPath, rawText, "utf8");
    }
  } catch {
    // best-effort
  }
  process.stderr.write(
    `[${catalogName}] corrupt catalog file quarantined at ${siblingPath} (${reason})\n`,
  );
}

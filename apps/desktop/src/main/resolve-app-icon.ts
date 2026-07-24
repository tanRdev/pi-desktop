import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the Pi Desktop app icon for Dock / window chrome.
 * Packaged builds prefer Resources; unpackaged falls back to repo `build/`.
 */
export function resolveAppIconPath(
  isPackaged: boolean,
  resourcesPath: string,
  mainEntryUrl: string = import.meta.url,
): string | null {
  const candidates: string[] = [];

  if (isPackaged) {
    candidates.push(
      path.join(resourcesPath, "icon.icns"),
      path.join(resourcesPath, "icon.png"),
    );
  }

  const mainDir = path.dirname(fileURLToPath(mainEntryUrl));
  // out/main → repo root is four levels up in both dev and packaged stage layouts
  const repoBuild = path.resolve(mainDir, "../../../../build");
  candidates.push(
    path.join(repoBuild, "icon.icns"),
    path.join(repoBuild, "icon.png"),
    path.join(repoBuild, "icon-512.png"),
  );

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

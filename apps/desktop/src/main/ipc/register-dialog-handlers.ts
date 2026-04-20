import { IPC_CHANNELS } from "@pi-desktop/shared";
import type { IpcRegistrar } from "../ipc-router";
import {
  PayloadValidationError,
  parseDialogOptionsStrict,
  requireStringField,
} from "./payload-parsers";

const OPEN_EXTERNAL_CHANNEL =
  IPC_CHANNELS.dialog.openExternal ?? "dialog:openExternal";

/**
 * Maximum length of an external URL. 2 KB covers every reasonable web link
 * and blocks data-URL / javascript: payload exhaustion.
 */
const MAX_EXTERNAL_URL_BYTES = 2048;

interface RegisterDialogHandlersDependencies {
  handle: IpcRegistrar["handle"];
}

export function registerDialogHandlers({
  handle,
}: RegisterDialogHandlersDependencies): void {
  handle(IPC_CHANNELS.dialog.showOpenDialog, async (_event, payload) => {
    // Strict parser rejects unknown keys so a compromised renderer cannot
    // smuggle e.g. `defaultPath: "/etc/passwd"` past the dialog.
    const options = parseDialogOptionsStrict(payload);
    const { dialog } = await import("electron");
    const result = await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths;
  });

  handle(OPEN_EXTERNAL_CHANNEL, async (_event, payload) => {
    const url = requireStringField(payload, "url");
    if (Buffer.byteLength(url, "utf-8") > MAX_EXTERNAL_URL_BYTES) {
      throw new PayloadValidationError(
        "payload/string-too-large",
        `openExternal url exceeds maximum size of ${MAX_EXTERNAL_URL_BYTES} bytes`,
        "url",
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new PayloadValidationError(
        "payload/wrong-type",
        "openExternal url must be a valid URL",
        "url",
      );
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new PayloadValidationError(
        "payload/wrong-type",
        "openExternal url must use http or https",
        "url",
      );
    }

    const { shell } = await import("electron");
    await shell.openExternal(parsedUrl.toString());
  });
}

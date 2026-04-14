import { IPC_CHANNELS } from "@pi-desktop/shared";
import type { IpcRegistrar } from "../ipc-router";
import { getStringField, parseDialogOptions } from "./payload-parsers";

const OPEN_EXTERNAL_CHANNEL =
  IPC_CHANNELS.dialog.openExternal ?? "dialog:openExternal";

interface RegisterDialogHandlersDependencies {
  handle: IpcRegistrar["handle"];
}

export function registerDialogHandlers({
  handle,
}: RegisterDialogHandlersDependencies): void {
  handle(IPC_CHANNELS.dialog.showOpenDialog, async (_event, payload) => {
    const { dialog } = await import("electron");
    const result = await dialog.showOpenDialog(parseDialogOptions(payload));
    return result.canceled ? null : result.filePaths;
  });

  handle(OPEN_EXTERNAL_CHANNEL, async (_event, payload) => {
    const url = getStringField(payload, "url");
    if (!url) {
      throw new Error("openExternal payload must include url");
    }

    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("openExternal url must use http or https");
    }

    const { shell } = await import("electron");
    await shell.openExternal(parsedUrl.toString());
  });
}

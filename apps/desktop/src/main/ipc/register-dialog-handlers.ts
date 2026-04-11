import { IPC_CHANNELS } from "@pidesk/shared";
import type { IpcRegistrar } from "../ipc-router";
import { parseDialogOptions } from "./payload-parsers";

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
}

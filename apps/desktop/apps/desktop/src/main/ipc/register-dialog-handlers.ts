import { IPC_CHANNELS } from "@pidesk/shared";
import { dialog } from "electron";
import { parseDialogOptions } from "./payload-parsers";

export function registerDialogHandlers(
  handle: (
    channel: string,
    listener: (
      event?: unknown,
      payload?: unknown,
    ) => Promise<unknown> | unknown,
  ) => void,
) {
  handle(IPC_CHANNELS.dialog.showOpenDialog, async (_event, payload) => {
    const result = await dialog.showOpenDialog(parseDialogOptions(payload));
    return result.canceled ? null : result.filePaths;
  });
}

export default undefined;

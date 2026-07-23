import {
  dialogContracts,
  registerContractHandler,
} from "@pi-desktop/contracts";
import type { IpcRegistrar } from "../ipc-router";

interface RegisterDialogHandlersDependencies {
  handle: IpcRegistrar["handle"];
}

export function registerDialogHandlers({
  handle,
}: RegisterDialogHandlersDependencies): void {
  registerContractHandler({
    handle,
    contract: dialogContracts.showOpenDialog,
    handler: async (options) => {
      const { dialog } = await import("electron");
      const result = await dialog.showOpenDialog(options);
      return result.canceled ? null : result.filePaths;
    },
  });

  registerContractHandler({
    handle,
    contract: dialogContracts.openExternal,
    handler: async ({ url }) => {
      const { shell } = await import("electron");
      await shell.openExternal(url);
    },
  });
}

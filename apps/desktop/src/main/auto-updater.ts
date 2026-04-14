import { dialog } from "electron";
import { autoUpdater } from "electron-updater";

const CHECK_DELAY_MS = 5_000;

let updateAvailable = false;

export function initAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    updateAvailable = true;
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Available",
        message: `Pi Desktop ${info.version} is available.`,
        detail: "Download and install now?",
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
        }
      })
      .catch(() => {});
  });

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message: "Update downloaded. Restart to apply?",
        buttons: ["Restart", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      })
      .catch(() => {});
  });

  autoUpdater.on("error", () => {});

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, CHECK_DELAY_MS);
}

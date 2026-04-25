import type { Effect } from "effect";
import { Effect as EffectRuntime } from "effect";
import { PiError } from "../effect/errors";

type MenuItemConstructorOptions = Electron.MenuItemConstructorOptions;

type AppLike = {
  name: string;
  isPackaged: boolean;
  getPath(name: "userData" | "exe"): string;
  relaunch(options: { args: string[] }): void;
  quit(): void;
};

type MenuLike = {
  buildFromTemplate(template: MenuItemConstructorOptions[]): unknown;
  setApplicationMenu(menu: unknown): void;
};

type DialogLike = {
  showMessageBox(options: Electron.MessageBoxOptions): Promise<{
    response: number;
  }>;
  showMessageBoxSync(options: Electron.MessageBoxSyncOptions): number;
  showErrorBox(title: string, content: string): void;
};

type InstallApplicationMenuDeps = {
  app: AppLike;
  menu: MenuLike;
  dialog: DialogLike;
  isMac: boolean;
  existsSync(path: string): boolean;
  rmSync(
    path: string,
    options: {
      recursive: boolean;
      force: boolean;
    },
  ): void;
  runEffectVoid(effect: Effect.Effect<void, never, never>): void;
};

function roleItem(
  role: MenuItemConstructorOptions["role"],
): MenuItemConstructorOptions {
  return { role };
}

function separatorItem(): MenuItemConstructorOptions {
  return { type: "separator" };
}

function createApplicationMenuTemplate(
  deps: InstallApplicationMenuDeps,
): MenuItemConstructorOptions[] {
  const macAppMenu: MenuItemConstructorOptions[] = deps.isMac
    ? [
        {
          label: deps.app.name,
          submenu: [
            roleItem("about"),
            separatorItem(),
            {
              label: "Uninstall Pi Desktop...",
              click: async () => {
                const response = await deps.dialog.showMessageBox({
                  type: "warning",
                  buttons: ["Cancel", "Uninstall"],
                  defaultId: 1,
                  title: "Uninstall Pi Desktop",
                  message: "Are you sure you want to uninstall Pi Desktop?",
                  detail:
                    "This will remove the application, your settings, and cached data. This action cannot be undone.",
                });

                if (response.response !== 1) {
                  return;
                }

                const uninstallEffect = EffectRuntime.try({
                  try: () => uninstallPiDesktop(deps),
                  catch: (error) =>
                    PiError.of("EINTERNAL", "Uninstall failed", error),
                }).pipe(
                  EffectRuntime.catchAll((error) =>
                    EffectRuntime.sync(() =>
                      deps.dialog.showErrorBox(
                        "Uninstall Failed",
                        error.message,
                      ),
                    ),
                  ),
                );

                deps.runEffectVoid(uninstallEffect);
              },
            },
            separatorItem(),
            roleItem("services"),
            separatorItem(),
            roleItem("hide"),
            roleItem("hideOthers"),
            roleItem("unhide"),
            separatorItem(),
            roleItem("quit"),
          ],
        },
      ]
    : [];

  const editMenuSubmenu: MenuItemConstructorOptions[] = [
    roleItem("undo"),
    roleItem("redo"),
    separatorItem(),
    roleItem("cut"),
    roleItem("copy"),
    roleItem("paste"),
    ...(deps.isMac
      ? [
          roleItem("pasteAndMatchStyle"),
          roleItem("delete"),
          roleItem("selectAll"),
          separatorItem(),
          {
            label: "Speech",
            submenu: [roleItem("startSpeaking"), roleItem("stopSpeaking")],
          },
        ]
      : [roleItem("delete"), separatorItem(), roleItem("selectAll")]),
  ];

  const windowMenuSubmenu: MenuItemConstructorOptions[] = [
    roleItem("minimize"),
    roleItem("zoom"),
    ...(deps.isMac
      ? [
          separatorItem(),
          roleItem("front"),
          separatorItem(),
          roleItem("window"),
        ]
      : [roleItem("close")]),
  ];

  return [
    ...macAppMenu,
    {
      label: "Edit",
      submenu: editMenuSubmenu,
    },
    {
      label: "View",
      submenu: [
        roleItem("reload"),
        roleItem("forceReload"),
        roleItem("toggleDevTools"),
        separatorItem(),
        roleItem("resetZoom"),
        roleItem("zoomIn"),
        roleItem("zoomOut"),
        separatorItem(),
        roleItem("togglefullscreen"),
      ],
    },
    {
      label: "Window",
      submenu: windowMenuSubmenu,
    },
  ];
}

function uninstallPiDesktop(deps: InstallApplicationMenuDeps): void {
  const userDataPath = deps.app.getPath("userData");
  const appPath = deps.app.getPath("exe");

  if (deps.existsSync(userDataPath)) {
    deps.rmSync(userDataPath, {
      recursive: true,
      force: true,
    });
  }

  if (deps.isMac && deps.app.isPackaged) {
    const appBundleMarker = ".app";
    const appBundleIndex = appPath.indexOf(appBundleMarker);

    if (appBundleIndex >= 0) {
      const appBundlePath = appPath.slice(
        0,
        appBundleIndex + appBundleMarker.length,
      );

      if (deps.existsSync(appBundlePath)) {
        deps.app.relaunch({
          args: ["--uninstall-script", appBundlePath],
        });
        deps.app.quit();
        return;
      }
    }
  }

  deps.dialog.showMessageBoxSync({
    message: "Pi Desktop data removed. You can now move the app to Trash.",
  });
  deps.app.quit();
}

export function installApplicationMenu(deps: InstallApplicationMenuDeps): void {
  const template = createApplicationMenuTemplate(deps);
  const builtMenu = deps.menu.buildFromTemplate(template);
  deps.menu.setApplicationMenu(builtMenu);
}

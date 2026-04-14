import { type CreatePiDesktopApiDependencies, createPiDesktopApi } from "./api";

export interface RegisterPiDesktopApiDependencies
  extends CreatePiDesktopApiDependencies {
  exposeInMainWorld(key: string, api: ReturnType<typeof createPiDesktopApi>): void;
}

export interface ElectronPreloadBindings {
  contextBridge: {
    exposeInMainWorld(
      key: string,
      api: ReturnType<typeof createPiDesktopApi>,
    ): void;
  };
  ipcRenderer: {
    invoke: CreatePiDesktopApiDependencies["invoke"];
    on(
      channel: string,
      listener: (event: unknown, payload: unknown) => void,
    ): void;
    removeListener(
      channel: string,
      listener: (event: unknown, payload: unknown) => void,
    ): void;
  };
}

export function registerPiDesktopApi({
  exposeInMainWorld,
  invoke,
  on,
}: RegisterPiDesktopApiDependencies): void {
  exposeInMainWorld("piDesktop", createPiDesktopApi({ invoke, on }));
}

export function registerPiDesktopApiFromElectron({
  contextBridge,
  ipcRenderer,
}: ElectronPreloadBindings): void {
  registerPiDesktopApi({
    exposeInMainWorld: contextBridge.exposeInMainWorld.bind(contextBridge),
    invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
    on: (channel, listener) => {
      const subscription = (_event: unknown, payload: unknown) => {
        listener(payload as Parameters<typeof listener>[0]);
      };

      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
  });
}

async function bootstrapPreload(): Promise<void> {
  if (!process.versions.electron) {
    return;
  }

  const electronModule = require("electron") as ElectronPreloadBindings;

  registerPiDesktopApiFromElectron(electronModule);
}

void bootstrapPreload();

import { type CreatePiDeskApiDependencies, createPiDeskApi } from "./api";

export interface RegisterPiDeskApiDependencies
  extends CreatePiDeskApiDependencies {
  exposeInMainWorld(key: string, api: ReturnType<typeof createPiDeskApi>): void;
}

export interface ElectronPreloadBindings {
  contextBridge: {
    exposeInMainWorld(
      key: string,
      api: ReturnType<typeof createPiDeskApi>,
    ): void;
  };
  ipcRenderer: {
    invoke: CreatePiDeskApiDependencies["invoke"];
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

export function registerPiDeskApi({
  exposeInMainWorld,
  invoke,
  on,
}: RegisterPiDeskApiDependencies): void {
  exposeInMainWorld("pidesk", createPiDeskApi({ invoke, on }));
}

export function registerPiDeskApiFromElectron({
  contextBridge,
  ipcRenderer,
}: ElectronPreloadBindings): void {
  registerPiDeskApi({
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

  registerPiDeskApiFromElectron(electronModule);
}

void bootstrapPreload();

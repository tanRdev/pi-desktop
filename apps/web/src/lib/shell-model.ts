// Thin shim that re-exports the shared shell model package and provides the
// legacy `shellModel` singleton for web consumers.
export * from "@pidesk/shell-model";

import { createShellModel } from "@pidesk/shell-model";
import { getPiDeskApi } from "./api-bridge";

// Instantiate the singleton model using the web API bridge so existing web
// code that imports `shellModel` keeps working.
export const shellModel = createShellModel(getPiDeskApi());

import type { OpenDialogOptions } from "@pi-desktop/shared";
import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";
import { createIpcContract } from "../contract-runtime.js";
import { createStrictObjectSchema, HttpOrHttpsUrlSchema } from "./helpers.js";

const OpenDialogPropertySchema = Schema.Literal(
  "openFile",
  "openDirectory",
  "multiSelections",
  "showHiddenFiles",
  "createDirectory",
  "promptToCreate",
  "noResolveAliases",
  "treatPackageAsDirectory",
  "dontAddToRecent",
);

const SHOW_OPEN_DIALOG_KEYS = new Set(["title", "properties"]);

export const ShowOpenDialogOptionsSchema =
  createStrictObjectSchema<OpenDialogOptions>(
    SHOW_OPEN_DIALOG_KEYS,
    {
      title: Schema.optional(Schema.String),
      properties: Schema.optional(Schema.Array(OpenDialogPropertySchema)),
    },
    { acceptMissing: true },
  );

export const ShowOpenDialogResponseSchema = Schema.NullOr(
  Schema.Array(Schema.String),
);

export const OpenExternalRequestSchema = createStrictObjectSchema<{
  readonly url: string;
}>(new Set(["url"]), {
  url: HttpOrHttpsUrlSchema,
});

export const dialogContracts = {
  showOpenDialog: createIpcContract({
    channel: IPC_CHANNELS.dialog.showOpenDialog,
    request: ShowOpenDialogOptionsSchema,
    response: ShowOpenDialogResponseSchema,
  }),
  openExternal: createIpcContract({
    channel: IPC_CHANNELS.dialog.openExternal,
    request: OpenExternalRequestSchema,
    response: Schema.Void,
  }),
} as const;

import { IPC_CHANNELS } from "@pi-desktop/shared";
import { Schema } from "effect";
import { createIpcContract } from "../contract-runtime.js";
import { createStrictObjectSchema } from "./helpers.js";

export const ClipboardWriteTextRequestSchema = createStrictObjectSchema<{
  readonly text: string;
}>(new Set(["text"]), {
  text: Schema.String,
});

export const clipboardContracts = {
  writeText: createIpcContract({
    channel: IPC_CHANNELS.clipboard.writeText,
    request: ClipboardWriteTextRequestSchema,
    response: Schema.Void,
  }),
} as const;

import { describe, expect, it } from "vitest";

import { IPC_CHANNELS as SharedChannels } from "../../shared/src/ipc/channels.js";
import { IPC_CHANNELS as ContractChannels } from "./channels.js";

describe("IPC channel SoT sync", () => {
  it("keeps shared mirror identical to contracts channels", () => {
    expect(SharedChannels).toEqual(ContractChannels);
  });
});

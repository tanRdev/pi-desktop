import type { AnyContract } from "./contract-runtime.js";
import { listDeclaredContractChannels } from "./contract-runtime.js";
import { snapshotContracts } from "./snapshot-contracts.js";

/**
 * Living typed Contract registry. Domain migrations append here so the
 * coverage gate can discover declared channels without scanning source.
 *
 * Migration mode: undeclared live IPC channels are reported; hard-fail waits
 * for Spine 1 finale (ticket 11).
 */
export const contractRegistry: readonly AnyContract[] = [
  snapshotContracts.shell.getSnapshot,
  snapshotContracts.agent.getProviders,
  snapshotContracts.agent.getSettings,
  snapshotContracts.agent.getSnapshot,
];

export function getRegisteredContractChannels(): string[] {
  return listDeclaredContractChannels(contractRegistry);
}

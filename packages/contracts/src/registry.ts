import type { AnyContract } from "./contract-runtime.js";
import { listDeclaredContractChannels } from "./contract-runtime.js";
import {
  agentContractList,
  clipboardContracts,
  dialogContracts,
  fsContractList,
  gitContractList,
  packagesContractList,
  repositoryContracts,
  searchContracts,
  stateContractList,
  terminalContractList,
  threadContracts,
  updatesContractList,
  windowContractList,
  worktreeContracts,
} from "./domains/index.js";
import { snapshotContracts } from "./snapshot-contracts.js";

/**
 * Living typed Contract registry. Domain migrations append here so the
 * coverage gate can discover declared channels without scanning source.
 *
 * Spine 1 finale flips CONTRACT_COVERAGE_STRICT=1 once every live channel
 * is listed here.
 */
export const contractRegistry: readonly AnyContract[] = [
  snapshotContracts.shell.getSnapshot,
  snapshotContracts.agent.getProviders,
  snapshotContracts.agent.getSettings,
  snapshotContracts.agent.getSnapshot,
  ...agentContractList,
  repositoryContracts.add,
  repositoryContracts.reorder,
  repositoryContracts.select,
  repositoryContracts.remove,
  repositoryContracts.openInFinder,
  worktreeContracts.create,
  worktreeContracts.select,
  worktreeContracts.remove,
  threadContracts.create,
  threadContracts.select,
  threadContracts.delete,
  dialogContracts.showOpenDialog,
  dialogContracts.openExternal,
  clipboardContracts.writeText,
  searchContracts.searchFiles,
  ...fsContractList,
  ...gitContractList,
  ...packagesContractList,
  ...terminalContractList,
  ...stateContractList,
  ...windowContractList,
  ...updatesContractList,
];

export function getRegisteredContractChannels(): string[] {
  return listDeclaredContractChannels(contractRegistry);
}

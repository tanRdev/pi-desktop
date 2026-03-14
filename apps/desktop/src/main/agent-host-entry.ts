import {
  type ParentPortLike,
  wireAgentHostParentPort,
} from "../../../../packages/agent-host/src/utility-process/bridge";

import { createAgentRuntimeForEntry } from "./agent-host-runtime";

type UtilityProcessWithParentPort = NodeJS.Process & {
  parentPort?: ParentPortLike;
};

function resolveParentPort(): ParentPortLike {
  const parentPort = (process as UtilityProcessWithParentPort).parentPort;

  if (!parentPort) {
    throw new Error("PiDesk agent host requires process.parentPort");
  }

  return parentPort;
}

function createAgentRuntime() {
  return createAgentRuntimeForEntry(process.env, process.cwd());
}

wireAgentHostParentPort({
  parentPort: resolveParentPort(),
  runtime: createAgentRuntime(),
});

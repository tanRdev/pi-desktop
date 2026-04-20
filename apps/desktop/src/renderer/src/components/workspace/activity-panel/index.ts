import {
  type ActivityLogStream,
  createActivityLogStream,
  getGlobalStream,
  MAX_VISIBLE_ENTRIES,
  setupIpcSubscription,
  type UseActivityLogResult,
  useActivityLog,
} from "./activity-log-stream";
import { ActivityPanel, type ActivityPanelProps } from "./activity-panel";
import {
  ActivityPanelHost,
  type ActivityPanelHostProps,
} from "./activity-panel-host";

export {
  ActivityPanel,
  ActivityPanelHost,
  useActivityLog,
  createActivityLogStream,
  getGlobalStream,
  setupIpcSubscription,
  MAX_VISIBLE_ENTRIES,
};

export type {
  ActivityPanelProps,
  ActivityPanelHostProps,
  ActivityLogStream,
  UseActivityLogResult,
};

import type { WorkspaceSession } from "@pi-desktop/shared";

import {
  createInitialWindowStoreState,
  type WindowUpdates,
  windowReducer,
} from "./window-store";
import { applyWorkspaceSessionLayout } from "./workspace-session-store-persistence";

type WindowActionSession = {
  layout: WorkspaceSession["layout"];
};

export function focusWorkspaceSessionWindow<
  Session extends WindowActionSession,
>(session: Session, windowId: string): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, {
      type: "FOCUS_WINDOW",
      payload: { windowId },
    }),
  );
}

export function moveWorkspaceSessionWindow<Session extends WindowActionSession>(
  session: Session,
  windowId: string,
  x: number,
  y: number,
): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, {
      type: "MOVE_WINDOW",
      payload: { windowId, x, y },
    }),
  );
}

export function resizeWorkspaceSessionWindow<
  Session extends WindowActionSession,
>(session: Session, windowId: string, width: number, height: number): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, {
      type: "RESIZE_WINDOW",
      payload: { windowId, width, height },
    }),
  );
}

export function updateWorkspaceSessionWindow<
  Session extends WindowActionSession,
>(session: Session, windowId: string, updates: WindowUpdates): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, {
      type: "UPDATE_WINDOW",
      payload: { windowId, updates },
    }),
  );
}

export function setWorkspaceSessionDirty<Session extends WindowActionSession>(
  session: Session,
  windowId: string,
  isDirty: boolean,
): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, {
      type: "SET_DIRTY",
      payload: { windowId, isDirty },
    }),
  );
}

export function setWorkspaceSessionZoom<Session extends WindowActionSession>(
  session: Session,
  zoom: number,
): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, {
      type: "SET_ZOOM",
      payload: { zoom },
    }),
  );
}

export function zoomWorkspaceSessionIn<Session extends WindowActionSession>(
  session: Session,
): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, { type: "ZOOM_IN" }),
  );
}

export function zoomWorkspaceSessionOut<Session extends WindowActionSession>(
  session: Session,
): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, { type: "ZOOM_OUT" }),
  );
}

export function resetWorkspaceSessionZoom<Session extends WindowActionSession>(
  session: Session,
): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, { type: "RESET_ZOOM" }),
  );
}

export function setWorkspaceSessionPan<Session extends WindowActionSession>(
  session: Session,
  panX: number,
  panY: number,
): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, {
      type: "SET_PAN",
      payload: { panX, panY },
    }),
  );
}

export function reorderWorkspaceSessionWindows<
  Session extends WindowActionSession,
>(session: Session, fromIndex: number, toIndex: number): Session {
  return applyWorkspaceSessionLayout(session, (windowState) =>
    windowReducer(windowState, {
      type: "REORDER_WINDOWS",
      payload: { fromIndex, toIndex },
    }),
  );
}

export function clearWorkspaceSessionWindows<
  Session extends WindowActionSession,
>(session: Session): Session {
  return {
    ...session,
    layout: createInitialWindowStoreState().layout,
  };
}

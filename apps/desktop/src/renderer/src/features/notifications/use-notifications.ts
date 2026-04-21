import { useCallback, useEffect, useState } from "react";
import {
  globalNotificationCenter,
  type Notification,
  type NotificationCenter,
  type NotificationLevel,
  type NotificationOptions,
} from "./notification-center";

export interface UseNotificationsResult {
  notifications: ReadonlyArray<Notification>;
  push: (
    level: NotificationLevel,
    message: string,
    options?: NotificationOptions,
  ) => Notification;
  success: (message: string, options?: NotificationOptions) => Notification;
  info: (message: string, options?: NotificationOptions) => Notification;
  warn: (message: string, options?: NotificationOptions) => Notification;
  error: (message: string, options?: NotificationOptions) => Notification;
  clear: () => void;
}

/**
 * Subscribes to a NotificationCenter and exposes push helpers.
 * Defaults to the module-level `globalNotificationCenter`.
 */
export function useNotifications(
  center: NotificationCenter = globalNotificationCenter,
): UseNotificationsResult {
  const [notifications, setNotifications] = useState<
    ReadonlyArray<Notification>
  >(() => center.list());

  useEffect(() => {
    const unsubscribe = center.subscribe(setNotifications);
    return unsubscribe;
  }, [center]);

  const push = useCallback(
    (
      level: NotificationLevel,
      message: string,
      options?: NotificationOptions,
    ) => center.push(level, message, options),
    [center],
  );
  const success = useCallback(
    (message: string, options?: NotificationOptions) =>
      center.success(message, options),
    [center],
  );
  const info = useCallback(
    (message: string, options?: NotificationOptions) =>
      center.info(message, options),
    [center],
  );
  const warn = useCallback(
    (message: string, options?: NotificationOptions) =>
      center.warn(message, options),
    [center],
  );
  const error = useCallback(
    (message: string, options?: NotificationOptions) =>
      center.error(message, options),
    [center],
  );
  const clear = useCallback(() => center.clear(), [center]);

  return { notifications, push, success, info, warn, error, clear };
}

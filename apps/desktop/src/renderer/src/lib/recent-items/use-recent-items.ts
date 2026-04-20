import { useCallback, useSyncExternalStore } from "react";
import type {
  CategoryItemMap,
  CategoryList,
  RecentCategory,
  RecentItem,
} from "./recent-items-store";
import {
  globalRecentItemsStore,
  type RecentItemsStore,
} from "./recent-items-store";

type CategoryHook<T extends RecentItem> = {
  readonly items: CategoryList;
  readonly add: (item: T) => void;
  readonly remove: (id: string) => void;
  readonly pin: (id: string) => void;
  readonly unpin: (id: string) => void;
  readonly clearAll: () => void;
};

function useRecentCategory<T extends RecentItem>(
  category: RecentCategory,
  store: RecentItemsStore = globalRecentItemsStore,
): CategoryHook<T> {
  const items = useSyncExternalStore(
    store.subscribe,
    () => store.list(category),
    () => store.list(category),
  );

  const add = useCallback(
    (item: T) => {
      store.add(category, item);
    },
    [store, category],
  );

  const remove = useCallback(
    (id: string) => {
      store.remove(category, id);
    },
    [store, category],
  );

  const pin = useCallback(
    (id: string) => {
      store.pin(category, id);
    },
    [store, category],
  );

  const unpin = useCallback(
    (id: string) => {
      store.unpin(category, id);
    },
    [store, category],
  );

  const clearAll = useCallback(() => {
    store.clearAll(category);
  }, [store, category]);

  return { items, add, remove, pin, unpin, clearAll };
}

export function useRecentFiles(
  store?: RecentItemsStore,
): CategoryHook<CategoryItemMap["files"]> {
  return useRecentCategory<CategoryItemMap["files"]>("files", store);
}

export function useRecentWorkspaces(
  store?: RecentItemsStore,
): CategoryHook<CategoryItemMap["workspaces"]> {
  return useRecentCategory<CategoryItemMap["workspaces"]>("workspaces", store);
}

export function useRecentThreads(
  store?: RecentItemsStore,
): CategoryHook<CategoryItemMap["threads"]> {
  return useRecentCategory<CategoryItemMap["threads"]>("threads", store);
}

export function useRecentItems(
  category: RecentCategory,
  store?: RecentItemsStore,
): CategoryHook<CategoryItemMap[RecentCategory]> {
  return useRecentCategory<CategoryItemMap[typeof category]>(category, store);
}

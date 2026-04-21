import { AppShortcuts } from "@/app-shortcuts";
import { Toaster } from "@/components/ui/sonner";
import { CommandPaletteHost } from "@/features/command-palette";
import { NotificationHost } from "@/features/notifications";
import { SettingsHost } from "@/features/settings";
import { type SnapshotApi, SnapshotHost } from "@/features/snapshots";
import { ActivityPanelHost } from "@/features/workspace/components/activity-panel";
import { SearchReplaceHost } from "@/features/workspace/components/search-replace";
import { ThreadSearchHost } from "@/features/workspace/components/thread-search";
import { KeyboardHost } from "@/lib/keyboard";
import { PerfHost } from "@/lib/perf";

export interface AppHostsProps {
  snapshotApi: SnapshotApi;
  searchReplaceFiles: readonly {
    filePath: string;
    content: string;
  }[];
}

export function AppHosts({ snapshotApi, searchReplaceFiles }: AppHostsProps) {
  return (
    <>
      <Toaster />
      <CommandPaletteHost />
      <ThreadSearchHost />
      <SettingsHost />
      <KeyboardHost />
      <NotificationHost />
      <PerfHost />
      <AppShortcuts />
      <SnapshotHost api={snapshotApi} />
      <ActivityPanelHost />
      <SearchReplaceHost files={searchReplaceFiles} />
    </>
  );
}

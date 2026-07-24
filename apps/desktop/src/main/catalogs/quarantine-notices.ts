/**
 * Startup-time Catalog quarantine buffer.
 *
 * `recoverCorruptFile` runs while constructing catalogs, before the renderer
 * exists. Notices are drained once via Contracts so the UI can toast.
 */

export type CatalogQuarantineNotice = {
  /** Glossary-friendly Catalog label — never a file path or raw JSON. */
  catalogLabel: string;
};

const LABEL_BY_CATALOG: Record<string, string> = {
  "app-preferences-catalog": "App preferences",
  "repository-preferences-catalog": "Repository preferences",
  "workspace-session-catalog": "Workspace session",
  "selection-state": "Selection",
  "repository-catalog": "Repositories",
  "thread-catalog": "Threads",
};

const pending: CatalogQuarantineNotice[] = [];

export function catalogLabelFor(catalogName: string): string {
  return LABEL_BY_CATALOG[catalogName] ?? "Catalog";
}

export function recordCatalogQuarantine(catalogName: string): void {
  pending.push({ catalogLabel: catalogLabelFor(catalogName) });
}

/** Returns and clears buffered notices (one-shot for renderer toast). */
export function drainCatalogQuarantineNotices(): CatalogQuarantineNotice[] {
  if (pending.length === 0) {
    return [];
  }
  return pending.splice(0, pending.length);
}

/** Test helper — clear buffer between cases. */
export function resetCatalogQuarantineNoticesForTests(): void {
  pending.length = 0;
}

export interface PlaceholderTabProps {
  name: string;
}

/**
 * Placeholder content for not-yet-implemented sidebar tabs.
 * The workspace-shell agent will replace instances of this with real content later.
 */
export function PlaceholderTab({ name }: PlaceholderTabProps) {
  return (
    <div
      data-testid={`sidebar-placeholder-${name}`}
      className="flex h-full w-full items-center justify-center p-6 text-center"
    >
      <span className="text-[11px] uppercase tracking-wider text-white/50">
        {name}
      </span>
    </div>
  );
}

export interface BreadcrumbSegment {
  label: string;
  path: string;
  isLast: boolean;
}

export interface UseBreadcrumbResult {
  segments: BreadcrumbSegment[];
  navigateTo: (path: string) => void;
}

function parseSegments(filePath: string): BreadcrumbSegment[] {
  const parts = filePath.split(/[/\\]/).filter(Boolean);
  const segments: BreadcrumbSegment[] = [];

  let accumulated = "";
  for (const [i, part] of parts.entries()) {
    accumulated = accumulated ? `${accumulated}/${part}` : part;
    segments.push({
      label: part,
      path: accumulated,
      isLast: i === parts.length - 1,
    });
  }

  return segments;
}

export function useBreadcrumb(
  filePath: string | null,
  onNavigate?: (path: string) => void,
): UseBreadcrumbResult {
  const segments = filePath ? parseSegments(filePath) : [];

  function navigateTo(path: string) {
    onNavigate?.(path);
  }

  return { segments, navigateTo };
}

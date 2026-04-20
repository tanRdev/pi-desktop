export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} satisfies Record<string, number>;

export type BreakpointKey = keyof typeof BREAKPOINTS;

const BREAKPOINT_ENTRIES = Object.entries(BREAKPOINTS) as Array<
  [BreakpointKey, number]
>;

export function getBreakpointForWidth(width: number): BreakpointKey {
  let current: BreakpointKey = "sm";
  for (const [key, value] of BREAKPOINT_ENTRIES) {
    if (width >= value) {
      current = key;
    }
  }
  return current;
}

export function matchBreakpoint(bp: BreakpointKey): boolean {
  if (typeof window === "undefined") return false;
  const pixelValue = BREAKPOINTS[bp];
  return window.matchMedia(`(min-width: ${pixelValue}px)`).matches;
}

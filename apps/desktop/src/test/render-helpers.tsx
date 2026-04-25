import { TooltipProvider } from "@pi-desktop/ui";
import {
  type RenderOptions,
  type RenderResult,
  render,
} from "@testing-library/react";
import type { ReactElement } from "react";

/**
 * Wrap `render()` with the global providers most workspace components require.
 *
 * Currently: `TooltipProvider`. Extend here as more context providers become
 * common requirements.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions = {},
): RenderResult {
  return render(<TooltipProvider>{ui}</TooltipProvider>, options);
}

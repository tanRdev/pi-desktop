import { describe, expect, it } from "vitest";
import { getCanvasGridStyle } from "../../../apps/desktop/src/renderer/src/components/canvas/canvas-grid";

describe("canvas-grid", () => {
  it("ties the visual grid spacing to the persisted snap grid size", () => {
    expect(getCanvasGridStyle(24)).toMatchObject({
      backgroundSize: "24px 24px",
      backgroundPosition: "0 0, 12px 12px",
    });
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

describe("DialogContent", () => {
  it("preserves centering transforms under reduced motion and constrains viewport height", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Dialog title" });

    expect(dialog.className).not.toContain("motion-reduce:transform-none");
    expect(dialog.className).toContain("max-h-[calc(100vh-2rem)]");
  });
});

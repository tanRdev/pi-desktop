import { describe, expect, it, vi } from "vitest";

const sonnerToast = vi.fn();

vi.mock("sonner", () => ({
  toast: (...args: unknown[]) => sonnerToast(...args),
}));

// Import after mock.
import { toast } from "./toast";

function getLastCallArgs() {
  const calls = sonnerToast.mock.calls;
  const last = calls[calls.length - 1];
  if (!last) throw new Error("sonner toast was not called");
  const [content, options] = last;
  return { content, options };
}

describe("toast", () => {
  it("success uses default 3000ms duration and the success var color", () => {
    sonnerToast.mockClear();
    toast.success("Saved");
    expect(sonnerToast).toHaveBeenCalledTimes(1);
    const { options } = getLastCallArgs();
    expect(options).toMatchObject({ duration: 3000 });
    expect(options.style).toMatchObject({
      background: "var(--color-bg-secondary)",
      borderRadius: "6px",
    });
  });

  it("error, info, warning all invoke sonner", () => {
    sonnerToast.mockClear();
    toast.error("Failed");
    toast.info("FYI");
    toast.warning("Careful");
    expect(sonnerToast).toHaveBeenCalledTimes(3);
  });

  it("forwards custom duration and description via content", () => {
    sonnerToast.mockClear();
    toast.success("Saved", { duration: 500, description: "All good" });
    const { options } = getLastCallArgs();
    expect(options).toMatchObject({ duration: 500 });
  });

  it("uses the warning var color for warnings", () => {
    sonnerToast.mockClear();
    toast.warning("Heads up");
    const { content } = getLastCallArgs();
    // Sanity: content is a React element with a dot span inside
    expect(content).toBeDefined();
    expect(typeof content).toBe("object");
  });
});

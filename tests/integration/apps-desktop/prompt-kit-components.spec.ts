import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("prompt kit workspace coverage", () => {
  it("ships the missing Prompt Kit component primitives in the desktop UI layer", () => {
    const componentPaths = [
      "apps/desktop/src/renderer/src/components/ui/feedback-bar.tsx",
      "apps/desktop/src/renderer/src/components/ui/file-upload.tsx",
      "apps/desktop/src/renderer/src/components/ui/image.tsx",
      "apps/desktop/src/renderer/src/components/ui/loader.tsx",
      "apps/desktop/src/renderer/src/components/ui/prompt-suggestion.tsx",
      "apps/desktop/src/renderer/src/components/ui/scroll-button.tsx",
      "apps/desktop/src/renderer/src/components/ui/source.tsx",
      "apps/desktop/src/renderer/src/components/ui/steps.tsx",
      "apps/desktop/src/renderer/src/components/ui/system-message.tsx",
    ];

    for (const componentPath of componentPaths) {
      expect(() => readSource(componentPath)).not.toThrow();
    }
  });

  it("loads the current prompt interaction primitives into the prompt dock", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(source).toContain("FileUpload");
    expect(source).toContain("Loader");
    expect(source).toContain("Image");
    expect(source).toContain("PromptAutocomplete");
  });

  it("uses the current transcript surfaces inside the chat-first thread panel", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );

    expect(source).toContain("FeedbackBar");
    expect(source).toContain("ScrollButton");
    expect(source).toContain("SystemMessage");
    expect(source).toContain("Tool");
    expect(source).not.toContain("Steps");
    expect(source).not.toContain("ThinkingBar");
    expect(source).not.toContain("TextShimmer");
  });
});

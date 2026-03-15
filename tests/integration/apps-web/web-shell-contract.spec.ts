import { readFile } from "fs/promises";
import path from "path";
import { describe, it } from "vitest";

const repoRoot = process.cwd();
const appPath = path.join(repoRoot, "apps/web/src/app.tsx");
const mockApiPath = path.join(repoRoot, "apps/web/src/lib/mock-api.ts");

describe("Chunk 4 - web shell rebind: source contract (RED)", () => {
  it("apps/web/src/app.tsx should use shared useShellModel and consume shared runtime state", async () => {
    const content = await readFile(appPath, "utf8");

    // 1) useShellModel must be referenced (import or call)
    if (!/useShellModel/.test(content)) {
      throw new Error(
        "Expected apps/web/src/app.tsx to import/use the shared hook `useShellModel` (hooks/use-shell-model.ts), but no occurrence was found.\n" +
          "Chunk-4 requires the web shell to rebind to the shared shell model API.",
      );
    }

    // 2) The UI should consume shared runtime state concepts such as state.shell, state.agent or state.live
    if (!/\bstate\.(shell|agent|live)\b/.test(content)) {
      throw new Error(
        "Expected apps/web/src/app.tsx to consume shared runtime state (e.g. access `state.shell`, `state.agent`, or `state.live`).\n" +
          "This ensures the UI is wired to the shared runtime model surface.",
      );
    }
  });

  it("apps/web/src/app.tsx should NOT contain local conversation mocks or thread state markers", async () => {
    const content = await readFile(appPath, "utf8");

    const markers: { name: string; pattern: RegExp }[] = [
      {
        name: "ConversationInstance interface",
        pattern: /\binterface\s+ConversationInstance\b/,
      },
      { name: "MOCK_INSTANCES constant", pattern: /\bMOCK_INSTANCES\b/ },
      {
        name: "local instances state (useState<ConversationInstance)",
        pattern: /useState<\s*ConversationInstance/,
      },
      {
        name: "instances state variable (const [instances,)",
        pattern: /\bconst\s*\[\s*instances\s*,/,
      },
    ];

    const found = markers.filter((m) => m.pattern.test(content));
    if (found.length > 0) {
      throw new Error(
        `Found local mock/thread implementation markers in apps/web/src/app.tsx: ${found
          .map((m) => m.name)
          .join(", ")}.\n` +
          "Chunk-4 requires the web shell to stop defining local conversation mocks and instead use the shared shell model.",
      );
    }
  });

  it("apps/web/src/lib/mock-api.ts should expose richer shell snapshot fields (runtime, workspace, capabilities, git)", async () => {
    const content = await readFile(mockApiPath, "utf8");

    const requiredFields = ["runtime", "workspace", "capabilities", "git"];
    const missing = requiredFields.filter(
      (f) => !new RegExp(`\\b${f}\\b`).test(content),
    );

    if (missing.length > 0) {
      throw new Error(
        `apps/web/src/lib/mock-api.ts must expose shell snapshot fields: ${requiredFields.join(", ")}. Missing: ${missing.join(", ")}.\n` +
          "The web mock API should mirror the desktop snapshot shape used by the shared shell model.",
      );
    }
  });

  it("apps/web/src/lib/mock-api.ts should use deterministic desktop-like assistant reply prefix", async () => {
    const content = await readFile(mockApiPath, "utf8");
    const prefix = "PiDesk mock assistant received:";
    if (!content.includes(prefix)) {
      throw new Error(
        `Expected apps/web/src/lib/mock-api.ts to include the deterministic assistant reply prefix "${prefix}".\n` +
          "Current web mock uses random canned responses; Chunk-4 requires desktop-like deterministic assistant replies.",
      );
    }
  });
});

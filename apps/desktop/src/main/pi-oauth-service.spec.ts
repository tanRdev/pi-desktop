import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getOAuthProvidersForAgentDir } from "./pi-oauth-service";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Pi OAuth provider compatibility", () => {
  it("exposes the default subscription providers without requiring credentials", async () => {
    const agentDirectory = mkdtempSync(
      path.join(tmpdir(), "pi-desktop-oauth-"),
    );
    temporaryDirectories.push(agentDirectory);

    const providers = await getOAuthProvidersForAgentDir(agentDirectory);
    const providerIds = providers.map((provider) => provider.id);

    expect(providerIds).toEqual(
      expect.arrayContaining(["anthropic", "github-copilot", "openai-codex"]),
    );
    expect(
      providers.find((provider) => provider.id === "anthropic")?.name,
    ).toMatch(/Claude/i);
    expect(
      providers.find((provider) => provider.id === "openai-codex")?.name,
    ).toMatch(/ChatGPT/i);
  });
});

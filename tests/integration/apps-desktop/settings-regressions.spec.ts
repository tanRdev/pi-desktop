import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getRuntimeProviders,
  getRuntimeSelection,
} from "../../../apps/desktop/src/renderer/src/components/settings/ai-runtime";
import { SETTINGS_MODAL_SECTION_IDS } from "../../../apps/desktop/src/renderer/src/components/settings/navigation";
import type { ProviderSnapshot } from "../../../packages/shared/src";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("settings regressions", () => {
  it("keeps only the live settings tabs in the modal navigation", () => {
    expect(SETTINGS_MODAL_SECTION_IDS).toEqual(["ai", "interface"]);
  });

  it("backs AI settings with runtime provider snapshots and model switching only", () => {
    const providers: ProviderSnapshot[] = [
      {
        id: "disabled",
        name: "Disabled",
        isConfigured: false,
        models: [{ id: "ignored", name: "Ignored", providerId: "disabled" }],
      },
      {
        id: "google",
        name: "Google",
        models: [
          {
            id: "gemini-2.5-pro",
            name: "Gemini 2.5 Pro",
            providerId: "google",
          },
          {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            providerId: "google",
          },
        ],
      },
      {
        id: "anthropic",
        name: "Anthropic",
        models: [],
      },
    ];
    const runtimeProviders = getRuntimeProviders(providers);

    expect(runtimeProviders.map((provider) => provider.id)).toEqual(["google"]);
    expect(
      getRuntimeSelection(runtimeProviders, {
        currentProviderId: "google",
        currentModelId: "gemini-2.5-flash",
      }),
    ).toMatchObject({
      currentProvider: runtimeProviders[0],
      currentModelId: "gemini-2.5-flash",
    });

    const aiSource = readSource(
      "apps/desktop/src/renderer/src/components/settings/sections/ai-settings.tsx",
    );

    expect(aiSource).toContain("providerSnapshots");
    expect(aiSource).toContain("settingsSnapshot");
    expect(aiSource).toContain("switchModel");
    expect(aiSource).not.toContain("API Key");
    expect(aiSource).not.toContain("Base URL");
    expect(aiSource).not.toContain("Temperature");
    expect(aiSource).not.toContain("Max Tokens");
    expect(aiSource).not.toContain("Top P");
    expect(aiSource).not.toContain("Top K");
    expect(aiSource).not.toContain("Context Window");
    expect(aiSource).not.toContain("System Prompt");
  });

  it("limits interface settings to the wired sidebar width control", () => {
    const interfaceSource = readSource(
      "apps/desktop/src/renderer/src/components/settings/sections/interface-settings.tsx",
    );

    expect(interfaceSource).toContain("Sidebar Width");
    expect(interfaceSource).not.toContain("Theme");
    expect(interfaceSource).not.toContain("Accent Color");
    expect(interfaceSource).not.toContain("Reduce Motion");
    expect(interfaceSource).not.toContain("Font Size");
    expect(interfaceSource).not.toContain("Interface Font");
    expect(interfaceSource).not.toContain("Code Font");
    expect(interfaceSource).not.toContain("Sidebar Position");
    expect(interfaceSource).not.toContain("Show Line Numbers");
  });
});

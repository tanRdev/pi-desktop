import { describe, expect, it } from "vitest";
import { createTemplateRegistry } from "./template-registry";
import { BUILT_IN_TEMPLATES } from "./workspace-template";

describe("createTemplateRegistry", () => {
  it("includes built-in templates by default", () => {
    const registry = createTemplateRegistry();
    const list = registry.listTemplates();
    expect(list.length).toBeGreaterThanOrEqual(BUILT_IN_TEMPLATES.length);
    const ids = list.map((t) => t.id);
    for (const builtIn of BUILT_IN_TEMPLATES) {
      expect(ids).toContain(builtIn.id);
    }
  });

  it("getTemplate returns a built-in by id", () => {
    const registry = createTemplateRegistry();
    const blank = registry.getTemplate("blank");
    expect(blank).not.toBeNull();
    expect(blank?.name).toBe("Blank");
  });

  it("getTemplate returns null for unknown id", () => {
    const registry = createTemplateRegistry();
    expect(registry.getTemplate("nonexistent")).toBeNull();
  });

  it("registerTemplate adds a custom template", () => {
    const registry = createTemplateRegistry();
    const custom = {
      id: "custom-1",
      name: "My Custom",
      description: "A custom template",
      icon: "Star",
      layout: { panes: [] },
      defaultCommands: ["echo hi"],
    };
    registry.registerTemplate(custom);
    const found = registry.getTemplate("custom-1");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("My Custom");
    expect(registry.listTemplates().length).toBe(BUILT_IN_TEMPLATES.length + 1);
  });

  it("registerTemplate overwrites when id matches existing", () => {
    const registry = createTemplateRegistry();
    const replacement = {
      id: "blank",
      name: "Blank Override",
      description: "Overridden blank template",
      icon: "Circle",
      layout: { panes: [] },
      defaultCommands: [],
    };
    registry.registerTemplate(replacement);
    const found = registry.getTemplate("blank");
    expect(found?.name).toBe("Blank Override");
    expect(registry.listTemplates().length).toBe(BUILT_IN_TEMPLATES.length);
  });

  it("creates empty registry when initialized with empty array", () => {
    const registry = createTemplateRegistry([]);
    expect(registry.listTemplates()).toEqual([]);
  });

  it("creates registry with custom initial templates", () => {
    const custom = {
      id: "mine",
      name: "Mine",
      description: "Custom",
      icon: "Heart",
      layout: { panes: [] },
      defaultCommands: [],
    };
    const registry = createTemplateRegistry([custom]);
    expect(registry.listTemplates()).toHaveLength(1);
    expect(registry.getTemplate("mine")?.name).toBe("Mine");
  });
});

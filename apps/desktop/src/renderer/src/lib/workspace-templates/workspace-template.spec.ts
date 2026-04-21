import { describe, expect, it } from "vitest";
import {
  BLANK_TEMPLATE,
  BUILT_IN_TEMPLATES,
  CODE_REVIEW_TEMPLATE,
  DEBUGGING_TEMPLATE,
  DOCUMENTATION_TEMPLATE,
  type WorkspaceTemplate,
} from "./workspace-template";

function assertValidTemplate(t: WorkspaceTemplate): void {
  expect(typeof t.id).toBe("string");
  expect(t.id.length).toBeGreaterThan(0);
  expect(typeof t.name).toBe("string");
  expect(t.name.length).toBeGreaterThan(0);
  expect(typeof t.description).toBe("string");
  expect(typeof t.icon).toBe("string");
  expect(t.icon.length).toBeGreaterThan(0);
  expect(Array.isArray(t.layout.panes)).toBe(true);
  expect(Array.isArray(t.defaultCommands)).toBe(true);
}

describe("WorkspaceTemplate type", () => {
  it("BLANK_TEMPLATE has required fields", () => {
    assertValidTemplate(BLANK_TEMPLATE);
  });

  it("CODE_REVIEW_TEMPLATE has required fields", () => {
    assertValidTemplate(CODE_REVIEW_TEMPLATE);
  });

  it("DEBUGGING_TEMPLATE has required fields", () => {
    assertValidTemplate(DEBUGGING_TEMPLATE);
  });

  it("DOCUMENTATION_TEMPLATE has required fields", () => {
    assertValidTemplate(DOCUMENTATION_TEMPLATE);
  });
});

describe("BUILT_IN_TEMPLATES", () => {
  it("contains exactly 4 templates", () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(4);
  });

  it("every built-in template is valid", () => {
    for (const t of BUILT_IN_TEMPLATES) {
      assertValidTemplate(t);
    }
  });

  it("all built-in template ids are unique", () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has expected template ids", () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(["blank", "code-review", "debugging", "documentation"]);
  });
});

describe("individual template structure", () => {
  it("BLANK_TEMPLATE has empty panes and no commands", () => {
    expect(BLANK_TEMPLATE.layout.panes).toEqual([]);
    expect(BLANK_TEMPLATE.defaultCommands).toEqual([]);
  });

  it("CODE_REVIEW_TEMPLATE has diff and discussion panes", () => {
    const paneTypes = CODE_REVIEW_TEMPLATE.layout.panes.map((p) => p.type);
    expect(paneTypes).toContain("diff");
    expect(paneTypes).toContain("thread");
    expect(CODE_REVIEW_TEMPLATE.defaultCommands.length).toBeGreaterThan(0);
  });

  it("DEBUGGING_TEMPLATE has terminal, logs, and inspector panes", () => {
    const paneTypes = DEBUGGING_TEMPLATE.layout.panes.map((p) => p.type);
    expect(paneTypes).toContain("terminal");
    expect(paneTypes).toContain("log-viewer");
    expect(paneTypes).toContain("inspector");
  });

  it("DOCUMENTATION_TEMPLATE has editor and preview panes", () => {
    const paneTypes = DOCUMENTATION_TEMPLATE.layout.panes.map((p) => p.type);
    expect(paneTypes).toContain("editor");
    expect(paneTypes).toContain("preview");
  });
});

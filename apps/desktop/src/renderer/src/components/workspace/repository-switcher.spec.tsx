import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepositorySwitcher } from "./repository-switcher";

function createRepository(
  id: string,
  overrides: Partial<RepositorySnapshot> = {},
): RepositorySnapshot {
  return {
    id,
    name: id,
    customName: null,
    icon: null,
    accentColor: null,
    rootPath: `/tmp/${id}`,
    defaultBranch: "main",
    worktrees: [],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("RepositorySwitcher", () => {
  it("returns null (component is disabled)", () => {
    const { container } = render(
      <RepositorySwitcher
        repositories={[createRepository("alpha")]}
        activeRepositoryId="alpha"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});

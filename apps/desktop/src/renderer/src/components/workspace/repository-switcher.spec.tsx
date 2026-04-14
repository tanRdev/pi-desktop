import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("lists repositories and forwards selection plus add actions", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAdd = vi.fn();

    render(
      <RepositorySwitcher
        repositories={[
          createRepository("alpha", { customName: "Alpha Workspace" }),
          createRepository("beta"),
        ]}
        activeRepositoryId="alpha"
        onSelect={onSelect}
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Switch projects" }));
    await user.click(screen.getByRole("button", { name: /beta/i }));
    await user.click(screen.getByRole("button", { name: /add repository/i }));

    expect(screen.getByText("Alpha Workspace")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith("beta");
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("uses the custom trigger aria label when one is provided", () => {
    render(
      <RepositorySwitcher
        repositories={[createRepository("alpha")]}
        activeRepositoryId="alpha"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        triggerAriaLabel="Switch active repository"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Switch active repository" }),
    ).toBeVisible();
  });
});

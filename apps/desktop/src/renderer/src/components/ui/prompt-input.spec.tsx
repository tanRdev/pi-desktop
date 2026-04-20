// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptInput, PromptInputTextarea } from "./prompt-input";

afterEach(() => {
  cleanup();
});

describe("PromptInput", () => {
  it("focuses the textarea when the container is clicked", async () => {
    const user = userEvent.setup();

    render(
      <PromptInput>
        <PromptInputTextarea aria-label="Prompt" />
      </PromptInput>,
    );

    await user.click(screen.getByRole("presentation"));

    expect(screen.getByLabelText("Prompt")).toHaveFocus();
  });

  it("forwards textarea value changes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <PromptInput onValueChange={onValueChange}>
        <PromptInputTextarea aria-label="Prompt" />
      </PromptInput>,
    );

    await user.type(screen.getByLabelText("Prompt"), "ship");

    expect(onValueChange).toHaveBeenLastCalledWith("ship");
  });

  it("submits on Enter but not on Shift+Enter", () => {
    const onSubmit = vi.fn();

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea aria-label="Prompt" />
      </PromptInput>,
    );

    const textarea = screen.getByLabelText("Prompt");

    fireEvent.keyDown(textarea, { key: "Enter" });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

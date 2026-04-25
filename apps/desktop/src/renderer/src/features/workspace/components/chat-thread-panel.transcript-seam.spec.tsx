// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

const chatThreadTranscriptMock = vi.fn<(props: unknown) => React.JSX.Element>(
  () => <div data-testid="chat-thread-transcript-seam" />,
);

vi.mock("./chat-thread-transcript", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./chat-thread-transcript")>();

  return {
    ...actual,
    ChatThreadTranscript: (props: unknown) => {
      chatThreadTranscriptMock(props);
      return <div data-testid="chat-thread-transcript-seam" />;
    },
  };
});

vi.mock("@/components/ui/activity-indicator", () => ({
  StreamingIndicator() {
    return <div data-testid="streaming-indicator" />;
  },
}));

vi.mock("@/components/ui/scroll-button", () => ({
  ScrollButton({ children }: React.PropsWithChildren) {
    return <button type="button">{children}</button>;
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
  },
}));

import { ChatThreadPanel } from "./chat-thread-panel";

describe("ChatThreadPanel transcript seam", () => {
  it("delegates transcript rendering to the dedicated transcript component", () => {
    render(
      <ChatThreadPanel
        threadTitle="Signal"
        messages={[]}
        isStreaming={false}
        lastError={null}
      />,
    );

    expect(
      screen.getByTestId("chat-thread-transcript-seam"),
    ).toBeInTheDocument();
    expect(chatThreadTranscriptMock).toHaveBeenCalledOnce();
  });
});

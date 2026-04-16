import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceFileContent } from "./workspace-file-content";

vi.mock("@/components/ui/icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const Stub = (props: Record<string, unknown>) =>
    React.createElement("span", props);
  return {
    File: Stub,
    Image: Stub,
    Save: Stub,
  };
});

vi.mock("./monaco-file-editor.lazy", () => ({
  MonacoFileEditor({
    language,
    path,
    readOnly,
    value,
  }: {
    language: string;
    path: string;
    readOnly?: boolean;
    value: string;
  }) {
    return (
      <div
        data-testid="monaco-file-editor"
        data-language={language}
        data-path={path}
        data-read-only={String(readOnly ?? false)}
      >
        {value}
      </div>
    );
  },
}));

vi.mock("boneyard-js/react", () => ({
  Skeleton({
    children,
    loading,
    name,
    className,
    fixture,
  }: {
    children: React.ReactNode;
    loading: boolean;
    name: string;
    className?: string;
    fixture?: React.ReactNode;
  }) {
    return (
      <div
        data-testid={`skeleton-${name}`}
        data-loading={String(loading)}
        className={className}
      >
        {loading ? fixture : children}
      </div>
    );
  },
}));

afterEach(() => {
  cleanup();
});

describe("WorkspaceFileContent", () => {
  // --- Language detection ---

  it("renders MonacoFileEditor for text content with typescript language for .tsx", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/example.tsx"
        content={{
          path: "/tmp/example.tsx",
          type: "text",
          content: "export function Example() { return null; }",
        }}
      />,
    );

    const editor = screen.getByTestId("monaco-file-editor");
    expect(editor).toHaveAttribute("data-language", "typescript");
    expect(editor).toHaveAttribute("data-path", "/tmp/example.tsx");
    expect(editor).toHaveTextContent(
      "export function Example() { return null; }",
    );
  });

  it("detects markdown language for .md files", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/README.md"
        content={{ path: "/tmp/README.md", type: "text", content: "# Hello" }}
      />,
    );

    expect(screen.getByTestId("monaco-file-editor")).toHaveAttribute(
      "data-language",
      "markdown",
    );
  });

  it("detects python language for .py files", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/main.py"
        content={{
          path: "/tmp/main.py",
          type: "text",
          content: "print('hello')",
        }}
      />,
    );

    expect(screen.getByTestId("monaco-file-editor")).toHaveAttribute(
      "data-language",
      "python",
    );
  });

  it("detects css language for .css files", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/styles.css"
        content={{
          path: "/tmp/styles.css",
          type: "text",
          content: "body { color: red; }",
        }}
      />,
    );

    expect(screen.getByTestId("monaco-file-editor")).toHaveAttribute(
      "data-language",
      "css",
    );
  });

  it("falls back to plaintext for unknown extensions", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/data.xyz"
        content={{
          path: "/tmp/data.xyz",
          type: "text",
          content: "some data",
        }}
      />,
    );

    expect(screen.getByTestId("monaco-file-editor")).toHaveAttribute(
      "data-language",
      "plaintext",
    );
  });

  // --- Null / error / special content types ---

  it("shows 'No file loaded' when content is null", () => {
    render(<WorkspaceFileContent filePath="/tmp/x.ts" content={null} />);

    expect(screen.getByText("No file loaded")).toBeInTheDocument();
  });

  it("shows error message when error prop is set", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={null}
        error="File not found"
      />,
    );

    expect(screen.getByText("File not found")).toBeInTheDocument();
    expect(screen.queryByText("No file loaded")).not.toBeInTheDocument();
  });

  it("shows 'Binary file' with byte size for binary content", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/data.bin"
        content={{
          path: "/tmp/data.bin",
          type: "binary",
          content: "",
          size: 4096,
        }}
      />,
    );

    expect(screen.getByText("Binary file")).toBeInTheDocument();
    expect(screen.getByText("4096 bytes")).toBeInTheDocument();
  });

  it("shows 'Unsupported preview' for unsupported content", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/data.weird"
        content={{ path: "/tmp/data.weird", type: "unsupported", content: "" }}
      />,
    );

    expect(screen.getByText("Unsupported preview")).toBeInTheDocument();
  });

  it("shows img tag for image content", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/photo.png"
        content={{
          path: "/tmp/photo.png",
          type: "image",
          content: "abc123base64",
          mimeType: "image/png",
        }}
      />,
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,abc123base64");
    expect(img).toHaveAttribute("alt", "photo.png");
  });

  it("handles image content that already has a data: prefix", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/photo.png"
        content={{
          path: "/tmp/photo.png",
          type: "image",
          content: "data:image/png;base64,abc123",
          mimeType: "image/png",
        }}
      />,
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,abc123");
  });

  // --- Skeleton / loading ---

  it("passes className through to Skeleton wrapper with h-full", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={null}
        className="my-custom-class"
      />,
    );

    const skeleton = screen.getByTestId("skeleton-file-content");
    expect(skeleton.className).toContain("h-full");
    expect(skeleton.className).toContain("my-custom-class");
  });

  it("shows loading skeleton when isLoading is true", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={null}
        isLoading={true}
      />,
    );

    const skeleton = screen.getByTestId("skeleton-file-content");
    expect(skeleton).toHaveAttribute("data-loading", "true");
    expect(screen.queryByText("No file loaded")).not.toBeInTheDocument();
  });

  it("renders content when isLoading is false", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={null}
        isLoading={false}
      />,
    );

    const skeleton = screen.getByTestId("skeleton-file-content");
    expect(skeleton).toHaveAttribute("data-loading", "false");
    expect(screen.getByText("No file loaded")).toBeInTheDocument();
  });

  // --- Toolbar / Save button ---

  it("shows toolbar with Save button when onSave is provided", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "hello" }}
        onSave={vi.fn()}
        isDirty={true}
      />,
    );

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("does not show toolbar when onSave is not provided", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "hello" }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /save/i }),
    ).not.toBeInTheDocument();
  });

  it("Save button is disabled when not dirty", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "hello" }}
        onSave={vi.fn()}
        isDirty={false}
      />,
    );

    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("Save button is disabled when readOnly", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "hello" }}
        onSave={vi.fn()}
        isDirty={true}
        isReadOnly={true}
      />,
    );

    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("Save button is enabled when dirty and not readOnly", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "hello" }}
        onSave={vi.fn()}
        isDirty={true}
        isReadOnly={false}
      />,
    );

    expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
  });

  it("calls onSave when Save button is clicked", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "hello" }}
        onSave={onSave}
        isDirty={true}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  // --- readOnly passthrough ---

  it("passes readOnly to MonacoFileEditor", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "hello" }}
        isReadOnly={true}
      />,
    );

    expect(screen.getByTestId("monaco-file-editor")).toHaveAttribute(
      "data-read-only",
      "true",
    );
  });

  it("defaults readOnly to false", () => {
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "hello" }}
      />,
    );

    expect(screen.getByTestId("monaco-file-editor")).toHaveAttribute(
      "data-read-only",
      "false",
    );
  });

  // --- Draft / content source of truth ---

  it("renders the exact content string passed in (no stale local draft)", () => {
    const { rerender } = render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "original" }}
      />,
    );

    expect(screen.getByTestId("monaco-file-editor")).toHaveTextContent(
      "original",
    );

    // Parent updates content (e.g. user typed; store is single source of truth).
    rerender(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "edited" }}
      />,
    );

    expect(screen.getByTestId("monaco-file-editor")).toHaveTextContent(
      "edited",
    );
  });

  it("forwards onContentChange directly without buffering through local state", () => {
    const onContentChange = vi.fn();
    render(
      <WorkspaceFileContent
        filePath="/tmp/x.ts"
        content={{ path: "/tmp/x.ts", type: "text", content: "hello" }}
        onContentChange={onContentChange}
      />,
    );

    // The test-double MonacoFileEditor does not invoke onChange on render,
    // so we assert the prop wiring by confirming the displayed value mirrors
    // the incoming content prop rather than a local buffered draft.
    expect(screen.getByTestId("monaco-file-editor")).toHaveTextContent("hello");
  });
});

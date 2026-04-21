// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropZone } from "./drop-zone";

class MockFileList {
  private items: File[] = [];
  get length() {
    return this.items.length;
  }
  item(index: number) {
    return this.items[index] ?? null;
  }
  [index: number]: File;
  constructor(files: File[]) {
    this.items = files;
    files.forEach((f, i) => {
      (this satisfies Record<number, File>)[i] = f;
    });
  }
  [Symbol.iterator](): Iterator<File> {
    return this.items[Symbol.iterator]();
  }
}

describe("DropZone", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children", () => {
    render(
      <DropZone onFilesDropped={() => {}}>
        <p>Hello</p>
      </DropZone>,
    );
    expect(screen.getByText("Hello")).not.toBeNull();
  });

  it("shows overlay on drag enter", () => {
    render(
      <DropZone onFilesDropped={() => {}}>
        <p>Content</p>
      </DropZone>,
    );
    const container = screen.getByText("Content").parentElement;
    if (!container) throw new Error("No parent element");
    fireEvent.dragEnter(container);
    expect(screen.getByText("Drop files here")).not.toBeNull();
  });

  it("hides overlay on drag leave after all enters leave", () => {
    render(
      <DropZone onFilesDropped={() => {}}>
        <p>Content</p>
      </DropZone>,
    );
    const container = screen.getByText("Content").parentElement;
    if (!container) throw new Error("No parent element");
    fireEvent.dragEnter(container);
    fireEvent.dragEnter(container);
    expect(screen.getByText("Drop files here")).not.toBeNull();
    fireEvent.dragLeave(container);
    expect(screen.getByText("Drop files here")).not.toBeNull();
    fireEvent.dragLeave(container);
    expect(screen.queryByText("Drop files here")).toBeNull();
  });

  it("calls onFilesDropped on drop", () => {
    const onFilesDropped = vi.fn();
    render(
      <DropZone onFilesDropped={onFilesDropped}>
        <p>Content</p>
      </DropZone>,
    );
    const container = screen.getByText("Content").parentElement;
    if (!container) throw new Error("No parent element");
    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const fileList = new MockFileList([file]);
    fireEvent.drop(container, {
      dataTransfer: { files: fileList },
    });
    expect(onFilesDropped).toHaveBeenCalledOnce();
    const firstCall = onFilesDropped.mock.calls[0];
    if (!firstCall) throw new Error("onFilesDropped was not called");
    const droppedFiles = firstCall[0];
    expect(droppedFiles.length).toBe(1);
    expect(droppedFiles[0].name).toBe("test.txt");
  });
});

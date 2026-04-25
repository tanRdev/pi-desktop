// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaPreview } from "./media-preview";

vi.mock("@/components/ui/phosphor-icons", () => ({
  get ICON_SIZE_SM() {
    return "size-3.5";
  },
  X: ({ className }: { className?: string }) => (
    <svg data-testid="icon-x" className={className} />
  ),
}));

afterEach(() => {
  cleanup();
});

const defaultProps = {
  filePath: "file:///photos/screenshot.png",
  onClose: vi.fn(),
};

describe("MediaPreview", () => {
  it("renders img with correct src", () => {
    render(<MediaPreview {...defaultProps} />);

    const img = screen.getByTestId("media-preview-image");
    expect(img).toHaveAttribute("src", defaultProps.filePath);
  });

  it("renders img with filename as alt text", () => {
    render(<MediaPreview {...defaultProps} />);

    const img = screen.getByTestId("media-preview-image");
    expect(img).toHaveAttribute("alt", "screenshot.png");
  });

  it("shows filename in the toolbar", () => {
    render(<MediaPreview {...defaultProps} />);

    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
  });

  it("renders zoom in button", () => {
    render(<MediaPreview {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /zoom in/i }),
    ).toBeInTheDocument();
  });

  it("renders zoom out button", () => {
    render(<MediaPreview {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /zoom out/i }),
    ).toBeInTheDocument();
  });

  it("renders close button", () => {
    render(<MediaPreview {...defaultProps} />);

    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("renders fit-to-view / actual-size toggle", () => {
    render(<MediaPreview {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /actual size/i }),
    ).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<MediaPreview filePath={defaultProps.filePath} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    closeButton.click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<MediaPreview filePath={defaultProps.filePath} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("zooms in when + key is pressed", () => {
    render(<MediaPreview {...defaultProps} />);

    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "+" });

    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("zooms in when = key is pressed", () => {
    render(<MediaPreview {...defaultProps} />);

    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "=" });

    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("zoom button click changes zoom level", () => {
    render(<MediaPreview {...defaultProps} />);

    expect(screen.getByText("100%")).toBeInTheDocument();

    const zoomInButton = screen.getByRole("button", { name: /zoom in/i });
    fireEvent.click(zoomInButton);

    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("uses object-contain on the image", () => {
    render(<MediaPreview {...defaultProps} />);

    const img = screen.getByTestId("media-preview-image");
    expect(img.className).toContain("object-contain");
  });

  it("renders overlay with correct backdrop style", () => {
    render(<MediaPreview {...defaultProps} />);

    const overlay = screen.getByTestId("media-preview-overlay");
    expect(overlay.className).toContain("bg-black/60");
  });

  it("shows image dimensions after load", () => {
    render(<MediaPreview {...defaultProps} />);

    const img = screen.getByTestId("media-preview-image");
    Object.defineProperty(img, "naturalWidth", {
      value: 1920,
      configurable: true,
    });
    Object.defineProperty(img, "naturalHeight", {
      value: 1080,
      configurable: true,
    });
    fireEvent.load(img);

    expect(screen.getByText("1920×1080")).toBeInTheDocument();
  });
});

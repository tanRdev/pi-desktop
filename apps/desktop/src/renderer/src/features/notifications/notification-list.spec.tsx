// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNotificationCenter,
  type ToastSurface,
} from "./notification-center";
import { NotificationList } from "./notification-list";

function createMockSurface(): ToastSurface {
  return {
    success: () => {},
    info: () => {},
    warning: () => {},
    error: () => {},
  };
}

afterEach(() => {
  cleanup();
});

describe("NotificationList", () => {
  it("renders nothing when closed", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    render(
      <NotificationList open={false} onOpenChange={() => {}} center={center} />,
    );
    expect(screen.queryByTestId("notifications-drawer")).toBeNull();
  });

  it("renders empty state when there are no notifications", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    render(
      <NotificationList open={true} onOpenChange={() => {}} center={center} />,
    );
    expect(screen.getByTestId("notifications-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("notifications-empty")).toBeInTheDocument();
  });

  it("renders pushed notifications", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    center.success("Saved");
    center.error("Failed", { description: "network error" });

    render(
      <NotificationList open={true} onOpenChange={() => {}} center={center} />,
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("network error")).toBeInTheDocument();
  });

  it("close button invokes onOpenChange(false)", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    const onOpenChange = vi.fn();
    render(
      <NotificationList
        open={true}
        onOpenChange={onOpenChange}
        center={center}
      />,
    );
    fireEvent.click(screen.getByTestId("notifications-close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("backdrop click closes the drawer", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    const onOpenChange = vi.fn();
    render(
      <NotificationList
        open={true}
        onOpenChange={onOpenChange}
        center={center}
      />,
    );
    fireEvent.click(screen.getByTestId("notifications-backdrop"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Escape closes the drawer", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    const onOpenChange = vi.fn();
    render(
      <NotificationList
        open={true}
        onOpenChange={onOpenChange}
        center={center}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clear button empties the list", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    center.info("a");
    render(
      <NotificationList open={true} onOpenChange={() => {}} center={center} />,
    );
    fireEvent.click(screen.getByTestId("notifications-clear"));
    expect(screen.queryByText("a")).toBeNull();
    expect(screen.getByTestId("notifications-empty")).toBeInTheDocument();
  });
});

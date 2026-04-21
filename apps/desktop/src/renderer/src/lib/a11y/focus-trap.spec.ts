// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { getFocusableElements, trapFocus } from "./focus-trap";

let containers: HTMLElement[] = [];

function mount(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  document.body.appendChild(div);
  containers.push(div);
  return div;
}

afterEach(() => {
  for (const c of containers) c.remove();
  containers = [];
});

function dispatchTab(target: Element, shift = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe("getFocusableElements", () => {
  it("collects buttons, links, inputs, and tabindex>=0 nodes", () => {
    const root = mount(`
      <button id="b1">b1</button>
      <a href="#x" id="a1">a1</a>
      <input id="i1" />
      <button id="b2" disabled>disabled</button>
      <div tabindex="0" id="d1">div</div>
      <div tabindex="-1" id="d2">div2</div>
      <input type="hidden" id="i2" />
    `);

    const ids = getFocusableElements(root).map((el) => el.id);
    expect(ids).toEqual(["b1", "a1", "i1", "d1"]);
  });

  it("skips aria-hidden and hidden elements", () => {
    const root = mount(`
      <button id="b1">b1</button>
      <button id="b2" aria-hidden="true">b2</button>
      <button id="b3" hidden>b3</button>
    `);
    const ids = getFocusableElements(root).map((el) => el.id);
    expect(ids).toEqual(["b1"]);
  });
});

describe("trapFocus", () => {
  it("wraps Tab from the last element back to the first", () => {
    const root = mount(`
      <button id="b1">b1</button>
      <button id="b2">b2</button>
      <button id="b3">b3</button>
    `);
    const release = trapFocus(root);

    const last = root.querySelector<HTMLElement>("#b3");
    if (!last) return;
    last.focus();
    expect(document.activeElement?.id).toBe("b3");

    const event = dispatchTab(last);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe("b1");

    release();
  });

  it("wraps Shift+Tab from the first element back to the last", () => {
    const root = mount(`
      <button id="b1">b1</button>
      <button id="b2">b2</button>
      <button id="b3">b3</button>
    `);
    const release = trapFocus(root);

    const first = root.querySelector<HTMLElement>("#b1");
    if (!first) return;
    first.focus();

    const event = dispatchTab(first, true);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe("b3");

    release();
  });

  it("does not interfere with Tab in the middle of the list", () => {
    const root = mount(`
      <button id="b1">b1</button>
      <button id="b2">b2</button>
      <button id="b3">b3</button>
    `);
    const release = trapFocus(root);

    const middle = root.querySelector<HTMLElement>("#b2");
    if (!middle) return;
    middle.focus();
    const event = dispatchTab(middle);
    expect(event.defaultPrevented).toBe(false);

    release();
  });

  it("focuses the first element when initialFocus is requested", () => {
    const root = mount(`
      <button id="outside">outside</button>
    `);
    document.body.appendChild(root);
    const inner = mount(`
      <button id="b1">b1</button>
      <button id="b2">b2</button>
    `);

    const release = trapFocus(inner, { initialFocus: true });
    expect(document.activeElement?.id).toBe("b1");
    release();
  });

  it("falls back to focusing the container when there are no focusable children", () => {
    const root = mount(`<div>no buttons</div>`);
    const release = trapFocus(root, { initialFocus: true });
    expect(root.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(root);
    release();
  });

  it("stops trapping after release()", () => {
    const root = mount(`
      <button id="b1">b1</button>
      <button id="b2">b2</button>
    `);
    const release = trapFocus(root);
    release();

    const last = root.querySelector<HTMLElement>("#b2");
    if (!last) return;
    last.focus();
    const event = dispatchTab(last);
    expect(event.defaultPrevented).toBe(false);
  });
});

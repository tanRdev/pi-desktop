// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createShortcutRegistry } from "./shortcut-registry";

function makeEvent(init: {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  target?: EventTarget | null;
}): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", {
    key: init.key,
    metaKey: init.meta ?? false,
    ctrlKey: init.ctrl ?? false,
    shiftKey: init.shift ?? false,
    altKey: init.alt ?? false,
    bubbles: true,
    cancelable: true,
  });
  if (init.target !== undefined && init.target !== null) {
    Object.defineProperty(ev, "target", { value: init.target });
  }
  return ev;
}

describe("shortcut-registry", () => {
  it("registers and dispatches on matching event", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const run = vi.fn();
    reg.register({
      id: "save",
      keys: "Mod+S",
      description: "Save",
      group: "File",
      run,
    });
    const ev = makeEvent({ key: "s", meta: true });
    expect(reg.handleEvent(ev)).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("unregister removes the binding", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const run = vi.fn();
    const dispose = reg.register({
      id: "save",
      keys: "Mod+S",
      description: "Save",
      group: "File",
      run,
    });
    dispose();
    const ev = makeEvent({ key: "s", meta: true });
    expect(reg.handleEvent(ev)).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("unregister by id works", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const run = vi.fn();
    reg.register({
      id: "save",
      keys: "Mod+S",
      description: "Save",
      group: "File",
      run,
    });
    reg.unregister("save");
    expect(reg.handleEvent(makeEvent({ key: "s", meta: true }))).toBe(false);
  });

  it("warns on conflicts but still registers", () => {
    const warn = vi.fn();
    const reg = createShortcutRegistry({
      platform: "mac",
      logger: { warn },
    });
    reg.register({
      id: "a",
      keys: "Mod+K",
      description: "A",
      group: "g",
      run: () => {},
    });
    reg.register({
      id: "b",
      keys: "Mod+K",
      description: "B",
      group: "g",
      run: () => {},
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("conflict"));
    expect(reg.list()).toHaveLength(2);
  });

  it("warns when replacing same id", () => {
    const warn = vi.fn();
    const reg = createShortcutRegistry({
      platform: "mac",
      logger: { warn },
    });
    reg.register({
      id: "dup",
      keys: "Mod+K",
      description: "A",
      group: "g",
      run: () => {},
    });
    reg.register({
      id: "dup",
      keys: "Mod+J",
      description: "B",
      group: "g",
      run: () => {},
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("replacing"));
    expect(reg.list()).toHaveLength(1);
  });

  it("subscribe notifies on register/unregister/clear", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const sub = vi.fn();
    const unsub = reg.subscribe(sub);
    // initial snapshot
    expect(sub).toHaveBeenCalledTimes(1);

    reg.register({
      id: "a",
      keys: "Mod+K",
      description: "",
      group: "g",
      run: () => {},
    });
    expect(sub).toHaveBeenCalledTimes(2);

    reg.unregister("a");
    expect(sub).toHaveBeenCalledTimes(3);

    reg.clear();
    expect(sub).toHaveBeenCalledTimes(4);

    unsub();
    reg.register({
      id: "b",
      keys: "Mod+J",
      description: "",
      group: "g",
      run: () => {},
    });
    expect(sub).toHaveBeenCalledTimes(4);
  });

  it("respects `when` predicate", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const run = vi.fn();
    let active = false;
    reg.register({
      id: "save",
      keys: "Mod+S",
      description: "",
      group: "g",
      when: () => active,
      run,
    });
    expect(reg.handleEvent(makeEvent({ key: "s", meta: true }))).toBe(false);
    active = true;
    expect(reg.handleEvent(makeEvent({ key: "s", meta: true }))).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("skips input targets unless allowInInput", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const blocked = vi.fn();
    const allowed = vi.fn();
    reg.register({
      id: "a",
      keys: "Mod+S",
      description: "",
      group: "g",
      run: blocked,
    });
    reg.register({
      id: "b",
      keys: "Mod+J",
      description: "",
      group: "g",
      allowInInput: true,
      run: allowed,
    });
    const input = document.createElement("input");
    expect(
      reg.handleEvent(makeEvent({ key: "s", meta: true, target: input })),
    ).toBe(false);
    expect(blocked).not.toHaveBeenCalled();
    expect(
      reg.handleEvent(makeEvent({ key: "j", meta: true, target: input })),
    ).toBe(true);
    expect(allowed).toHaveBeenCalledTimes(1);
  });

  it("accepts array of keys and matches any", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const run = vi.fn();
    reg.register({
      id: "nav",
      keys: ["Mod+K", "Mod+P"],
      description: "",
      group: "g",
      run,
    });
    expect(reg.handleEvent(makeEvent({ key: "k", meta: true }))).toBe(true);
    expect(reg.handleEvent(makeEvent({ key: "p", meta: true }))).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("calls preventDefault and stopPropagation by default", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    reg.register({
      id: "a",
      keys: "Mod+S",
      description: "",
      group: "g",
      run: () => {},
    });
    const ev = makeEvent({ key: "s", meta: true });
    const pd = vi.spyOn(ev, "preventDefault");
    const sp = vi.spyOn(ev, "stopPropagation");
    reg.handleEvent(ev);
    expect(pd).toHaveBeenCalled();
    expect(sp).toHaveBeenCalled();
  });
});

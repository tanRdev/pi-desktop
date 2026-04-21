// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHistory } from "./command-history";

const STORAGE_KEY = "pi-desktop:command-history";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("CommandHistory", () => {
  it("records an invocation and returns it in getRecent", () => {
    const history = new CommandHistory();
    history.recordInvocation("cmd-a");
    expect(history.getRecent()).toEqual(["cmd-a"]);
  });

  it("returns recent commands ordered by most recent timestamp", () => {
    const history = new CommandHistory();
    history.recordInvocation("cmd-a");
    history.recordInvocation("cmd-b");
    history.recordInvocation("cmd-c");
    expect(history.getRecent()).toEqual(["cmd-c", "cmd-b", "cmd-a"]);
  });

  it("respects the limit parameter in getRecent", () => {
    const history = new CommandHistory();
    history.recordInvocation("a");
    history.recordInvocation("b");
    history.recordInvocation("c");
    expect(history.getRecent(2)).toEqual(["c", "b"]);
  });

  it("increments count on repeated invocations of the same command", () => {
    const history = new CommandHistory();
    history.recordInvocation("cmd-a");
    history.recordInvocation("cmd-a");
    history.recordInvocation("cmd-a");
    history.recordInvocation("cmd-b");
    const frequent = history.getFrequent();
    expect(frequent[0]).toBe("cmd-a");
  });

  it("returns frequent commands ordered by invocation count descending", () => {
    const history = new CommandHistory();
    history.recordInvocation("c");
    history.recordInvocation("a");
    history.recordInvocation("a");
    history.recordInvocation("a");
    history.recordInvocation("b");
    history.recordInvocation("b");
    expect(history.getFrequent()).toEqual(["a", "b", "c"]);
  });

  it("respects the limit parameter in getFrequent", () => {
    const history = new CommandHistory();
    history.recordInvocation("a");
    history.recordInvocation("b");
    history.recordInvocation("c");
    expect(history.getFrequent(2)).toHaveLength(2);
  });

  it("clears all history", () => {
    const history = new CommandHistory();
    history.recordInvocation("a");
    history.recordInvocation("b");
    history.clear();
    expect(history.getRecent()).toEqual([]);
    expect(history.getFrequent()).toEqual([]);
  });

  it("enforces max size of 100 entries", () => {
    const history = new CommandHistory();
    for (let i = 0; i < 120; i += 1) {
      history.recordInvocation(`cmd-${i}`);
    }
    const recent = history.getRecent(200);
    expect(recent.length).toBeLessThanOrEqual(100);
  });

  it("persists to localStorage and recovers on construction", () => {
    const first = new CommandHistory();
    first.recordInvocation("persisted-cmd");
    const second = new CommandHistory();
    expect(second.getRecent()).toEqual(["persisted-cmd"]);
  });

  it("recovers gracefully from invalid localStorage data", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");
    const history = new CommandHistory();
    expect(history.getRecent()).toEqual([]);
    history.recordInvocation("after-corrupt");
    const next = new CommandHistory();
    expect(next.getRecent()).toEqual(["after-corrupt"]);
  });
});

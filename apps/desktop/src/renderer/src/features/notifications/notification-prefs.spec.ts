// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  getNotificationPrefs,
  isLevelEnabled,
  isScopeMuted,
  resetNotificationPrefs,
  setNotificationPrefs,
} from "./notification-prefs";

describe("notification-prefs", () => {
  afterEach(() => {
    resetNotificationPrefs();
  });

  it("returns defaults when nothing is stored", () => {
    const prefs = getNotificationPrefs();
    expect(prefs.sounds).toBe(true);
    expect(prefs.desktop).toBe(false);
    expect(prefs.levels).toEqual(["warn", "error"]);
    expect(prefs.mutedScopes).toEqual([]);
  });

  it("partially updates prefs and persists", () => {
    const updated = setNotificationPrefs({ sounds: false });
    expect(updated.sounds).toBe(false);
    expect(updated.desktop).toBe(false);
    expect(updated.levels).toEqual(["warn", "error"]);

    const reloaded = getNotificationPrefs();
    expect(reloaded.sounds).toBe(false);
  });

  it("updates levels and persists", () => {
    const all: Array<"success" | "info" | "warn" | "error"> = [
      "success",
      "info",
      "warn",
      "error",
    ];
    setNotificationPrefs({ levels: all });
    const prefs = getNotificationPrefs();
    expect(prefs.levels).toEqual(all);
  });

  it("updates mutedScopes and persists", () => {
    setNotificationPrefs({ mutedScopes: ["backup", "sync"] });
    const prefs = getNotificationPrefs();
    expect(prefs.mutedScopes).toEqual(["backup", "sync"]);
  });

  it("isLevelEnabled returns true for levels in the list", () => {
    expect(isLevelEnabled("warn")).toBe(true);
    expect(isLevelEnabled("error")).toBe(true);
  });

  it("isLevelEnabled returns false for levels not in the list", () => {
    expect(isLevelEnabled("success")).toBe(false);
    expect(isLevelEnabled("info")).toBe(false);
  });

  it("isLevelEnabled updates when levels change", () => {
    expect(isLevelEnabled("info")).toBe(false);
    setNotificationPrefs({
      levels: ["success", "info", "warn", "error"],
    });
    expect(isLevelEnabled("info")).toBe(true);
  });

  it("isScopeMuted returns false for unmuted scopes", () => {
    expect(isScopeMuted("anything")).toBe(false);
  });

  it("isScopeMuted returns true after muting", () => {
    setNotificationPrefs({ mutedScopes: ["backup"] });
    expect(isScopeMuted("backup")).toBe(true);
    expect(isScopeMuted("other")).toBe(false);
  });

  it("resetNotificationPrefs restores defaults", () => {
    setNotificationPrefs({ sounds: false, desktop: true, mutedScopes: ["x"] });
    const result = resetNotificationPrefs();
    expect(result.sounds).toBe(true);
    expect(result.desktop).toBe(false);
    expect(result.levels).toEqual(["warn", "error"]);
    expect(result.mutedScopes).toEqual([]);

    const reloaded = getNotificationPrefs();
    expect(reloaded.sounds).toBe(true);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("pi-desktop:notification-prefs", "not-json");
    const prefs = getNotificationPrefs();
    expect(prefs).toEqual({
      sounds: true,
      desktop: false,
      levels: ["warn", "error"],
      mutedScopes: [],
    });
  });
});

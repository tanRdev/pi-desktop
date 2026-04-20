import { describe, expect, it } from "vitest";
import { createBeep } from "./notification-sound";

describe("notification-sound", () => {
  describe("createBeep", () => {
    it("returns frequency and duration for a given input", () => {
      const result = createBeep(440, 80);
      expect(result).toEqual({ frequency: 440, duration: 80 });
    });

    it("returns correct params for success level (C5)", () => {
      expect(createBeep(523, 80)).toEqual({ frequency: 523, duration: 80 });
    });

    it("returns correct params for info level (E5)", () => {
      expect(createBeep(659, 80)).toEqual({ frequency: 659, duration: 80 });
    });

    it("returns correct params for warn level (G5)", () => {
      expect(createBeep(784, 80)).toEqual({ frequency: 784, duration: 80 });
    });

    it("returns correct params for error level (A4)", () => {
      expect(createBeep(440, 80)).toEqual({ frequency: 440, duration: 80 });
    });

    it("handles different durations", () => {
      expect(createBeep(1000, 200)).toEqual({ frequency: 1000, duration: 200 });
    });
  });
});

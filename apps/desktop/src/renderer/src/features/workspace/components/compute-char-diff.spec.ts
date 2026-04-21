import { describe, expect, it } from "vitest";
import { computeCharDiff } from "./compute-char-diff";

describe("computeCharDiff", () => {
  it("returns full prefix and empty middles for identical strings", () => {
    const result = computeCharDiff("hello", "hello");
    expect(result).toEqual({
      prefix: "hello",
      oldMiddle: "",
      newMiddle: "",
      suffix: "",
    });
  });

  it("returns empty prefix and full old/new middles for completely different strings", () => {
    const result = computeCharDiff("abc", "xyz");
    expect(result).toEqual({
      prefix: "",
      oldMiddle: "abc",
      newMiddle: "xyz",
      suffix: "",
    });
  });

  it("finds common prefix with differing suffixes", () => {
    const result = computeCharDiff("fooBar", "fooBaz");
    expect(result).toEqual({
      prefix: "fooBa",
      oldMiddle: "r",
      newMiddle: "z",
      suffix: "",
    });
  });

  it("finds common suffix with differing prefixes", () => {
    const result = computeCharDiff("oldSuffix", "newSuffix");
    expect(result).toEqual({
      prefix: "",
      oldMiddle: "old",
      newMiddle: "new",
      suffix: "Suffix",
    });
  });

  it("finds middle insertion when prefix and suffix are shared", () => {
    const result = computeCharDiff("abGHef", "abCDef");
    expect(result).toEqual({
      prefix: "ab",
      oldMiddle: "GH",
      newMiddle: "CD",
      suffix: "ef",
    });
  });

  it("handles empty old string with non-empty new string", () => {
    const result = computeCharDiff("", "inserted");
    expect(result).toEqual({
      prefix: "",
      oldMiddle: "",
      newMiddle: "inserted",
      suffix: "",
    });
  });

  it("handles non-empty old string with empty new string", () => {
    const result = computeCharDiff("removed", "");
    expect(result).toEqual({
      prefix: "",
      oldMiddle: "removed",
      newMiddle: "",
      suffix: "",
    });
  });

  it("handles both empty strings", () => {
    const result = computeCharDiff("", "");
    expect(result).toEqual({
      prefix: "",
      oldMiddle: "",
      newMiddle: "",
      suffix: "",
    });
  });
});

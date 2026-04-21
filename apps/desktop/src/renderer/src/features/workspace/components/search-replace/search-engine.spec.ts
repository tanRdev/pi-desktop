import { describe, expect, it } from "vitest";
import {
  buildSearchRegex,
  computeReplaceText,
  type FileContent,
  getFileExtension,
  matchFileFilter,
  replaceInContent,
  searchFiles,
  searchInContent,
} from "./search-engine";

function makeFile(filePath: string, content: string): FileContent {
  return { filePath, content };
}

describe("buildSearchRegex", () => {
  it("returns null for empty pattern", () => {
    expect(buildSearchRegex("", {})).toBeNull();
    expect(buildSearchRegex("   ", {})).toBeNull();
  });

  it("escapes special regex chars when isRegex is false", () => {
    const regex = buildSearchRegex("file.ts", {});
    expect(regex).not.toBeNull();
    expect(regex?.test("file.ts")).toBe(true);
    expect(regex?.test("fileXts")).toBe(false);
  });

  it("uses raw pattern when isRegex is true", () => {
    const regex = buildSearchRegex("f.*e", { isRegex: true });
    expect(regex).not.toBeNull();
    const r1 = buildSearchRegex("f.*e", { isRegex: true });
    expect(r1?.test("file")).toBe(true);
    const r2 = buildSearchRegex("f.*e", { isRegex: true });
    expect(r2?.test("fixe")).toBe(true);
  });

  it("returns null for invalid regex", () => {
    expect(buildSearchRegex("[invalid", { isRegex: true })).toBeNull();
  });

  it("respects isCaseSensitive option", () => {
    const ci = buildSearchRegex("hello", { isCaseSensitive: false });
    expect(ci?.test("HELLO")).toBe(true);

    const cs = buildSearchRegex("hello", { isCaseSensitive: true });
    expect(cs?.test("HELLO")).toBe(false);
    expect(cs?.test("hello")).toBe(true);
  });
});

describe("searchInContent", () => {
  it("returns matches with correct line numbers and highlights", () => {
    const content = "line one\nhello world\nline three";
    const matches = searchInContent(content, "hello", {});
    expect(matches).toHaveLength(1);
    expect(matches[0]?.lineNumber).toBe(2);
    expect(matches[0]?.column).toBe(1);
    expect(matches[0]?.highlights).toEqual([{ start: 0, end: 5 }]);
  });

  it("finds multiple matches on the same line", () => {
    const content = "foo bar foo baz";
    const matches = searchInContent(content, "foo", {});
    expect(matches).toHaveLength(1);
    expect(matches[0]?.highlights).toHaveLength(2);
  });

  it("finds matches across multiple lines", () => {
    const content = "first foo\nsecond foo\nthird bar";
    const matches = searchInContent(content, "foo", {});
    expect(matches).toHaveLength(2);
    expect(matches[0]?.lineNumber).toBe(1);
    expect(matches[1]?.lineNumber).toBe(2);
  });

  it("returns empty for no matches", () => {
    const content = "nothing here";
    expect(searchInContent(content, "xyz", {})).toEqual([]);
  });

  it("respects case sensitivity", () => {
    const content = "Hello hello HELLO";
    const ci = searchInContent(content, "hello", { isCaseSensitive: false });
    expect(ci).toHaveLength(1);
    expect(ci[0]?.highlights).toHaveLength(3);

    const cs = searchInContent(content, "hello", { isCaseSensitive: true });
    expect(cs).toHaveLength(1);
    expect(cs[0]?.highlights).toHaveLength(1);
  });

  it("supports regex patterns", () => {
    const content = "abc123def456";
    const matches = searchInContent(content, "\\d+", { isRegex: true });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.highlights).toHaveLength(2);
  });
});

describe("matchFileFilter", () => {
  it("returns true for empty filter", () => {
    expect(matchFileFilter("src/index.ts", "")).toBe(true);
    expect(matchFileFilter("src/index.ts", "   ")).toBe(true);
  });

  it("matches extension glob", () => {
    expect(matchFileFilter("src/index.ts", "*.ts")).toBe(true);
    expect(matchFileFilter("src/index.tsx", "*.ts")).toBe(false);
    expect(matchFileFilter("src/index.js", "*.ts")).toBe(false);
  });

  it("matches path glob", () => {
    expect(matchFileFilter("src/utils/index.ts", "src/**")).toBe(true);
    expect(matchFileFilter("lib/utils/index.ts", "src/**")).toBe(false);
  });

  it("matches multiple comma-separated patterns", () => {
    expect(matchFileFilter("src/index.ts", "*.ts, *.tsx")).toBe(true);
    expect(matchFileFilter("src/index.tsx", "*.ts, *.tsx")).toBe(true);
    expect(matchFileFilter("src/index.js", "*.ts, *.tsx")).toBe(false);
  });

  it("matches exact filename without glob", () => {
    expect(matchFileFilter("src/package.json", "package.json")).toBe(true);
    expect(matchFileFilter("src/index.ts", "package.json")).toBe(false);
  });
});

describe("searchFiles", () => {
  const files: FileContent[] = [
    makeFile(
      "src/index.ts",
      "export const hello = 'world';\nconsole.log(hello);",
    ),
    makeFile(
      "src/utils.ts",
      "function hello() { return 'hi'; }\n// hello comment",
    ),
    makeFile("README.md", "# Hello World\nThis is the readme."),
  ];

  it("returns empty for empty pattern", () => {
    expect(searchFiles(files, "", {})).toEqual([]);
    expect(searchFiles(files, "   ", {})).toEqual([]);
  });

  it("searches across files and returns ranked results", () => {
    const results = searchFiles(files, "hello", {});
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.filePath).toBeDefined();
    expect(results[0]?.matches.length).toBeGreaterThan(0);
  });

  it("applies file filter", () => {
    const results = searchFiles(files, "hello", { fileFilter: "*.ts" });
    expect(results.every((r) => r.filePath.endsWith(".ts"))).toBe(true);
  });

  it("ranks by match count", () => {
    const manyMatches = makeFile("a.ts", "foo foo foo");
    const oneMatch = makeFile("b.ts", "foo");
    const results = searchFiles([oneMatch, manyMatches], "foo", {});
    expect(results[0]?.filePath).toBe("a.ts");
  });

  it("respects maxResults", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makeFile(`file${i}.ts`, "match content"),
    );
    const results = searchFiles(many, "match", { maxResults: 3 });
    expect(results).toHaveLength(3);
  });
});

describe("replaceInContent", () => {
  it("replaces all matches in content", () => {
    const result = replaceInContent("hello world hello", "hello", "hi", {});
    expect(result).toBe("hi world hi");
  });

  it("respects case sensitivity when replacing", () => {
    const result = replaceInContent("Hello hello HELLO", "hello", "hi", {
      isCaseSensitive: true,
    });
    expect(result).toBe("Hello hi HELLO");
  });

  it("supports regex replacement", () => {
    const result = replaceInContent("abc123def456", "\\d+", "X", {
      isRegex: true,
    });
    expect(result).toBe("abcXdefX");
  });

  it("returns original content for invalid regex", () => {
    const result = replaceInContent("hello", "[invalid", "hi", {
      isRegex: true,
    });
    expect(result).toBe("hello");
  });

  it("returns original for empty pattern", () => {
    const result = replaceInContent("hello", "", "hi", {});
    expect(result).toBe("hello");
  });
});

describe("getFileExtension", () => {
  it("extracts extension from file path", () => {
    expect(getFileExtension("src/index.ts")).toBe("ts");
    expect(getFileExtension("README.md")).toBe("md");
  });

  it("returns empty for dotfiles", () => {
    expect(getFileExtension(".gitignore")).toBe("");
  });

  it("returns empty for no extension", () => {
    expect(getFileExtension("Makefile")).toBe("");
  });

  it("handles multi-dot filenames", () => {
    expect(getFileExtension("file.test.ts")).toBe("ts");
  });
});

describe("computeReplaceText", () => {
  it("returns replace text verbatim when not regex", () => {
    expect(computeReplaceText("hello", "world", false)).toBe("world");
  });
});

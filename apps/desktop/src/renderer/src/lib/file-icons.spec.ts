import { describe, expect, it } from "vitest";
import {
  File,
  FileCode,
  FileCss,
  FileTs,
  FileTsx,
  Gear,
  Image,
  Lock,
  Package,
  Scales,
} from "@phosphor-icons/react";
import { getFileIconByExtension } from "./file-icons";

describe("getFileIconByExtension", () => {
  describe("extension matching", () => {
    it("maps .ts and .tsx to dedicated FileTs / FileTsx icons", () => {
      expect(getFileIconByExtension("app.ts", "ts").Icon).toBe(FileTs);
      expect(getFileIconByExtension("App.tsx", "tsx").Icon).toBe(FileTsx);
    });

    it("tints TypeScript files blue", () => {
      expect(getFileIconByExtension("x.ts", "ts").colorClassName).toContain(
        "blue",
      );
    });

    it("maps stylesheet variants to FileCss", () => {
      for (const ext of ["css", "scss", "sass", "less"]) {
        expect(getFileIconByExtension(`x.${ext}`, ext).Icon).toBe(FileCss);
      }
    });

    it("maps generic code languages without dedicated glyphs to FileCode", () => {
      for (const ext of ["go", "rb", "java", "kt", "swift", "c", "cpp", "sh"]) {
        expect(getFileIconByExtension(`x.${ext}`, ext).Icon).toBe(FileCode);
      }
    });

    it("maps common image extensions to the Image icon", () => {
      for (const ext of ["png", "jpg", "gif", "webp", "avif", "ico"]) {
        expect(getFileIconByExtension(`x.${ext}`, ext).Icon).toBe(Image);
      }
    });

    it("treats extension lookup as case-insensitive", () => {
      expect(getFileIconByExtension("App.TSX", "TSX").Icon).toBe(FileTsx);
    });

    it("tints .json yellow via FileCode", () => {
      const result = getFileIconByExtension("data.json", "json");
      expect(result.Icon).toBe(FileCode);
      expect(result.colorClassName).toContain("yellow");
    });

    it("tints .yaml pink via FileCode", () => {
      const result = getFileIconByExtension("config.yaml", "yaml");
      expect(result.Icon).toBe(FileCode);
      expect(result.colorClassName).toContain("pink");
    });
  });

  describe("filename override precedence", () => {
    it("picks Dockerfile / Makefile via Gear regardless of extension", () => {
      expect(getFileIconByExtension("Dockerfile", null).Icon).toBe(Gear);
      expect(getFileIconByExtension("Makefile", null).Icon).toBe(Gear);
    });

    it("resolves LICENSE to Scales", () => {
      expect(getFileIconByExtension("LICENSE", null).Icon).toBe(Scales);
    });

    it("resolves README.md via filename override, not .md extension", () => {
      const mdFile = getFileIconByExtension("notes.md", "md");
      const readme = getFileIconByExtension("README.md", "md");
      // README.md uses BookOpen (override), plain .md uses FileMd.
      expect(readme.Icon).not.toBe(mdFile.Icon);
    });

    it("resolves package.json to Package (not generic .json FileCode)", () => {
      expect(getFileIconByExtension("package.json", "json").Icon).toBe(Package);
    });

    it("resolves .env* files to Lock", () => {
      expect(getFileIconByExtension(".env", null).Icon).toBe(Lock);
      expect(getFileIconByExtension(".env.local", "local").Icon).toBe(Lock);
      expect(getFileIconByExtension(".env.production", "production").Icon).toBe(
        Lock,
      );
    });

    it("matches tsconfig*.json via prefix pattern", () => {
      expect(getFileIconByExtension("tsconfig.json", "json").Icon).toBe(Gear);
      expect(getFileIconByExtension("tsconfig.base.json", "json").Icon).toBe(
        Gear,
      );
    });

    it("matches .eslintrc* via prefix pattern", () => {
      expect(getFileIconByExtension(".eslintrc", null).Icon).toBe(Gear);
      expect(getFileIconByExtension(".eslintrc.json", "json").Icon).toBe(Gear);
      expect(getFileIconByExtension(".eslintrc.cjs", "cjs").Icon).toBe(Gear);
    });

    it("is case-insensitive for filename overrides", () => {
      expect(getFileIconByExtension("dockerfile", null).Icon).toBe(Gear);
      expect(getFileIconByExtension("readme", null).Icon).toBe(
        getFileIconByExtension("README", null).Icon,
      );
    });
  });

  describe("default fallback", () => {
    it("falls back to the plain File icon for unknown extensions", () => {
      expect(getFileIconByExtension("notes.xyz", "xyz").Icon).toBe(File);
    });

    it("falls back to File when no extension is provided", () => {
      expect(getFileIconByExtension("randomfile", null).Icon).toBe(File);
    });

    it("uses a muted default color for the fallback", () => {
      expect(getFileIconByExtension("randomfile", null).colorClassName).toBe(
        "text-white/50",
      );
    });
  });
});

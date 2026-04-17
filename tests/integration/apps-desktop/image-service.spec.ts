import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ImageService } from "../../../apps/desktop/src/main/image-service";

const tempDirs: string[] = [];

function createDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pi-desktop-img-"));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("ImageService input validation", () => {
  it("rejects non-absolute paths", async () => {
    const service = new ImageService();
    await expect(service.getMetadata("relative/path.png")).rejects.toThrow(
      /absolute/i,
    );
  });

  it("rejects empty paths", async () => {
    const service = new ImageService();
    await expect(service.getMetadata("")).rejects.toThrow(/non-empty/i);
  });

  it("rejects paths with a disallowed extension", async () => {
    const dir = createDir();
    const bogus = path.join(dir, "pwn.sh");
    fs.writeFileSync(bogus, "#!/bin/sh\n");
    const service = new ImageService();
    await expect(service.getMetadata(bogus)).rejects.toThrow(
      /Unsupported image extension/i,
    );
  });

  it("rejects paths that do not resolve to a regular file", async () => {
    const dir = createDir();
    // Give the directory itself an image-looking name.
    const weird = path.join(dir, "sub.png");
    fs.mkdirSync(weird);
    const service = new ImageService();
    await expect(service.getMetadata(weird)).rejects.toThrow(/regular file/i);
  });

  it("rejects files above the size ceiling without invoking sharp", async () => {
    const dir = createDir();
    const huge = path.join(dir, "huge.png");
    // Fake an oversize file cheaply by truncating to (MAX + 1) bytes.
    const fd = fs.openSync(huge, "w");
    fs.ftruncateSync(fd, 64 * 1024 * 1024 + 1);
    fs.closeSync(fd);
    const service = new ImageService();
    await expect(service.getMetadata(huge)).rejects.toThrow(
      /maximum file size/i,
    );
  });
});

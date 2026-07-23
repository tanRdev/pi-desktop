import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  PackageInstallRequestSchema,
  PackageListInstalledRequestSchema,
  PackageRemoveRequestSchema,
  PackageSearchRequestSchema,
  PackagesEventSchema,
  PackageUpdateRequestSchema,
  packagesContracts,
} from "./packages.js";

describe("packages request schemas", () => {
  it("accepts valid searchCatalog payloads", () => {
    expect(
      Schema.decodeUnknownSync(PackageSearchRequestSchema)({
        query: "theme",
        sort: "downloads",
        kinds: ["theme", "extension"],
        hasDemoOnly: true,
      }),
    ).toEqual({
      query: "theme",
      sort: "downloads",
      kinds: ["theme", "extension"],
      hasDemoOnly: true,
    });
  });

  it("rejects searchCatalog payloads with unknown keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(PackageSearchRequestSchema)({
        query: "theme",
        sort: "downloads",
        kinds: [],
        limit: 10,
      }),
    ).toThrow(/unknown field "limit"/);
  });

  it("accepts install, remove, and update payloads", () => {
    expect(
      Schema.decodeUnknownSync(PackageInstallRequestSchema)({
        packageName: "@pi/theme-dark",
        scope: "global",
      }),
    ).toEqual({
      packageName: "@pi/theme-dark",
      scope: "global",
    });

    expect(
      Schema.decodeUnknownSync(PackageRemoveRequestSchema)({
        packageName: "@pi/theme-dark",
        scope: "local",
      }),
    ).toEqual({
      packageName: "@pi/theme-dark",
      scope: "local",
    });

    expect(
      Schema.decodeUnknownSync(PackageUpdateRequestSchema)({
        scope: "global",
      }),
    ).toEqual({ scope: "global" });

    expect(
      Schema.decodeUnknownSync(PackageUpdateRequestSchema)({
        packageName: "@pi/theme-dark",
        scope: "local",
      }),
    ).toEqual({
      packageName: "@pi/theme-dark",
      scope: "local",
    });
  });

  it("rejects install payloads missing required fields", () => {
    expect(() =>
      Schema.decodeUnknownSync(PackageInstallRequestSchema)({
        packageName: "@pi/theme-dark",
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(PackageInstallRequestSchema)({
        scope: "global",
      }),
    ).toThrow();
  });

  it("accepts listInstalled payloads with optional scope", () => {
    expect(
      Schema.decodeUnknownSync(PackageListInstalledRequestSchema)({
        scope: "global",
      }),
    ).toEqual({ scope: "global" });
    expect(
      Schema.decodeUnknownSync(PackageListInstalledRequestSchema)({}),
    ).toEqual({});
  });

  it("rejects listInstalled payloads with invalid scope", () => {
    expect(() =>
      Schema.decodeUnknownSync(PackageListInstalledRequestSchema)({
        scope: "workspace",
      }),
    ).toThrow();
  });
});

describe("PackagesEventSchema", () => {
  it("accepts operation and installed-state event payloads", () => {
    expect(
      Schema.decodeUnknownSync(PackagesEventSchema)({
        type: "operation_updated",
        operation: {
          id: "op-1",
          packageName: "@pi/theme-dark",
          scope: "global",
          kind: "install",
          status: "running",
          message: null,
          output: [],
        },
      }),
    ).toEqual({
      type: "operation_updated",
      operation: {
        id: "op-1",
        packageName: "@pi/theme-dark",
        scope: "global",
        kind: "install",
        status: "running",
        message: null,
        output: [],
      },
    });

    expect(
      Schema.decodeUnknownSync(PackagesEventSchema)({
        type: "installed_state_changed",
        scope: "local",
        installed: [
          {
            source: "npm:@pi/theme-dark",
            name: "@pi/theme-dark",
            version: "1.0.0",
            scope: "local",
            installPath: "/tmp/packages/theme-dark",
            isPinned: false,
          },
        ],
      }),
    ).toEqual({
      type: "installed_state_changed",
      scope: "local",
      installed: [
        {
          source: "npm:@pi/theme-dark",
          name: "@pi/theme-dark",
          version: "1.0.0",
          scope: "local",
          installPath: "/tmp/packages/theme-dark",
          isPinned: false,
        },
      ],
    });
  });

  it("rejects malformed packages event payloads", () => {
    expect(() =>
      Schema.decodeUnknownSync(PackagesEventSchema)({
        type: "operation_updated",
        operation: {
          id: "op-1",
          packageName: "@pi/theme-dark",
          scope: "global",
          kind: "install",
          status: "running",
          message: null,
        },
      }),
    ).toThrow();
  });
});

describe("packagesContracts", () => {
  it("declares all packages invoke channels plus the event contract", () => {
    expect(packagesContracts.getManagerStatus.channel).toBe(
      "packages:getManagerStatus",
    );
    expect(packagesContracts.searchCatalog.channel).toBe(
      "packages:searchCatalog",
    );
    expect(packagesContracts.getPackageDetail.channel).toBe(
      "packages:getPackageDetail",
    );
    expect(packagesContracts.listInstalled.channel).toBe(
      "packages:listInstalled",
    );
    expect(packagesContracts.install.channel).toBe("packages:install");
    expect(packagesContracts.remove.channel).toBe("packages:remove");
    expect(packagesContracts.update.channel).toBe("packages:update");
    expect(packagesContracts.event.kind).toBe("event");
    expect(packagesContracts.event.channel).toBe("packages:event");
  });
});

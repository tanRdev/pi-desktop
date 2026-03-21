import type { SearchRequest, TerminalCreateOptions } from "@pidesk/shared";
import type { OpenDialogOptions } from "electron";

function isPayloadRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getStringField(
  payload: unknown,
  key: string,
): string | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

export function getNumberField(
  payload: unknown,
  key: string,
): number | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}

export function getBooleanField(
  payload: unknown,
  key: string,
): boolean | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === "boolean" ? value : undefined;
}

export function getStringArrayField(
  payload: unknown,
  key: string,
): string[] | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

export function parseDialogOptions(payload: unknown): OpenDialogOptions {
  const options: OpenDialogOptions = {};
  const title = getStringField(payload, "title");
  if (title) {
    options.title = title;
  }

  const properties = getStringArrayField(payload, "properties");
  if (properties) {
    options.properties = properties.filter(
      (
        property,
      ): property is NonNullable<OpenDialogOptions["properties"]>[number] =>
        property === "openFile" ||
        property === "openDirectory" ||
        property === "multiSelections" ||
        property === "showHiddenFiles" ||
        property === "createDirectory" ||
        property === "promptToCreate" ||
        property === "noResolveAliases" ||
        property === "treatPackageAsDirectory" ||
        property === "dontAddToRecent",
    );
  }

  return options;
}

export function parseSearchRequest(payload: unknown): SearchRequest | null {
  const query = getStringField(payload, "query");
  const rootPath = getStringField(payload, "rootPath");
  if (!query || !rootPath) {
    return null;
  }

  return {
    query,
    rootPath,
    maxResults: getNumberField(payload, "maxResults"),
    includePatterns: getStringArrayField(payload, "includePatterns"),
    excludePatterns: getStringArrayField(payload, "excludePatterns"),
  };
}

export function parseTerminalCreateOptions(
  payload: unknown,
): TerminalCreateOptions | null {
  const id = getStringField(payload, "id");
  const cols = getNumberField(payload, "cols");
  const rows = getNumberField(payload, "rows");
  const ownerWindowId = getStringField(payload, "ownerWindowId");
  if (
    !id ||
    typeof cols !== "number" ||
    typeof rows !== "number" ||
    !ownerWindowId
  ) {
    return null;
  }

  const backend = getStringField(payload, "backend");

  return {
    id,
    cols,
    rows,
    ownerWindowId,
    cwd: getStringField(payload, "cwd"),
    backend: backend === "shell" || backend === "lazygit" ? backend : undefined,
  };
}

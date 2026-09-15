export const BUILD_HEAP_OPTION = "--max-old-space-size=8192";

export function withBuildHeap(env = process.env) {
  const current = env.NODE_OPTIONS ?? "";
  if (/(?:^|\s)--max-old-space-size=/.test(current)) {
    return { ...env };
  }
  return {
    ...env,
    NODE_OPTIONS: [current, BUILD_HEAP_OPTION].filter(Boolean).join(" "),
  };
}

export function hasNotarizationCredentials(env = process.env) {
  const hasAppleIdCredentials =
    Boolean(env.APPLE_ID) &&
    Boolean(env.APPLE_APP_SPECIFIC_PASSWORD) &&
    Boolean(env.APPLE_TEAM_ID);
  const hasApiKeyCredentials =
    Boolean(env.APPLE_API_KEY) &&
    Boolean(env.APPLE_API_KEY_ID) &&
    Boolean(env.APPLE_API_ISSUER);
  const hasKeychainProfile = Boolean(env.APPLE_KEYCHAIN_PROFILE);
  return hasAppleIdCredentials || hasApiKeyCredentials || hasKeychainProfile;
}

export function isDeveloperIdSignature(signature) {
  return (
    !signature.includes("Signature=adhoc") &&
    !signature.includes("TeamIdentifier=not set") &&
    signature.includes("Authority=Developer ID Application")
  );
}

function parseVersionParts(tag) {
  const normalized = String(tag).replace(/^v/, "");
  return normalized.split(/[.-]/).map((part) => {
    const value = Number.parseInt(part, 10);
    return Number.isNaN(value) ? part : value;
  });
}

export function compareReleaseTags(left, right) {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart === rightPart) {
      continue;
    }
    if (typeof leftPart === "number" && typeof rightPart === "number") {
      return leftPart - rightPart;
    }
    return String(leftPart).localeCompare(String(rightPart));
  }
  return 0;
}

export function shouldMarkReleaseLatest(tag, publishedTags) {
  return publishedTags.every(
    (publishedTag) => compareReleaseTags(tag, publishedTag) >= 0,
  );
}

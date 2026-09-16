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

function parsePrereleaseIdentifiers(prerelease) {
  return prerelease.split(".").map((part) => {
    const value = Number.parseInt(part, 10);
    return Number.isNaN(value) || String(value) !== part ? part : value;
  });
}

export function parseReleaseTag(tag) {
  const normalized = String(tag).replace(/^v/, "");
  const match = normalized.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/,
  );
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? parsePrereleaseIdentifiers(match[4]) : null,
  };
}

function comparePrerelease(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    if (leftPart === rightPart) {
      continue;
    }
    if (typeof leftPart === "number" && typeof rightPart === "number") {
      return leftPart - rightPart;
    }
    if (typeof leftPart === "number") {
      return -1;
    }
    if (typeof rightPart === "number") {
      return 1;
    }
    return String(leftPart).localeCompare(String(rightPart));
  }
  return 0;
}

export function compareReleaseTags(left, right) {
  const leftVersion = parseReleaseTag(left);
  const rightVersion = parseReleaseTag(right);
  if (!leftVersion || !rightVersion) {
    return String(left).localeCompare(String(right));
  }
  if (leftVersion.major !== rightVersion.major) {
    return leftVersion.major - rightVersion.major;
  }
  if (leftVersion.minor !== rightVersion.minor) {
    return leftVersion.minor - rightVersion.minor;
  }
  if (leftVersion.patch !== rightVersion.patch) {
    return leftVersion.patch - rightVersion.patch;
  }
  if (!leftVersion.prerelease && !rightVersion.prerelease) {
    return 0;
  }
  if (!leftVersion.prerelease) {
    return 1;
  }
  if (!rightVersion.prerelease) {
    return -1;
  }
  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
}

export function shouldMarkReleaseLatest(tag, publishedTags) {
  return publishedTags.every(
    (publishedTag) => compareReleaseTags(tag, publishedTag) >= 0,
  );
}

export function githubReleaseEditArgs(tag, publishedTags) {
  return [
    "release",
    "edit",
    tag,
    "--draft=false",
    shouldMarkReleaseLatest(tag, publishedTags)
      ? "--latest=true"
      : "--latest=false",
  ];
}

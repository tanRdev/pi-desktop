export const DEFAULT_UNTITLED_THREAD_TITLE = "Pi";

export const FALLBACK_THREAD_TITLES = [
  "Signal",
  "Axiom",
  "Beacon",
  "Brio",
  "Cinder",
  "Cipher",
  "Clove",
  "Cobalt",
  "Comet",
  "Crux",
  "Dawn",
  "Drift",
  "Echo",
  "Ember",
  "Fable",
  "Flint",
  "Flux",
  "Frost",
  "Gale",
  "Glimmer",
  "Glyph",
  "Harbor",
  "Haze",
  "Helix",
  "Indigo",
  "Iris",
  "Jasper",
  "Jolt",
  "Karma",
  "Kite",
  "Lattice",
  "Lumen",
  "Lyric",
  "Mirth",
  "Mist",
  "Muse",
  "Nimbus",
  "Nova",
  "Nyx",
  "Onyx",
  "Orbit",
  "Parallax",
  "Phoenix",
  "Pillar",
  "Pixel",
  "Prism",
  "Pulse",
  "Quasar",
  "Quest",
  "Quill",
  "Radiant",
  "Raven",
  "Ripple",
  "Rune",
  "Sable",
  "Saffron",
  "Sage",
  "Scarlet",
  "Shiver",
  "Solace",
  "Spark",
  "Static",
  "Strata",
  "Summit",
  "Sylvan",
  "Tangent",
  "Tempest",
  "Thorn",
  "Thrum",
  "Torrent",
  "Umber",
  "Vale",
  "Vector",
  "Velvet",
  "Vesper",
  "Vivid",
  "Warden",
  "Whisper",
  "Willow",
  "Zephyr",
  "Zinnia",
  "Aurora",
  "Mosaic",
  "Tundra",
  "Crescent",
  "Marble",
  "Topaz",
  "Kindle",
  "Riddle",
  "Vertex",
  "Cascade",
  "Briar",
  "Aster",
  "Lucent",
  "Kestrel",
  "Mirage",
  "Dusk",
] as const;

export function getDefaultThreadTitle(): string {
  return DEFAULT_UNTITLED_THREAD_TITLE;
}

export function createThreadTitle(
  random = Math.random,
  usedTitles: ReadonlySet<string> = new Set(),
): string {
  const availableTitles = FALLBACK_THREAD_TITLES.filter(
    (title) => !usedTitles.has(title),
  );

  if (availableTitles.length === 0) {
    return DEFAULT_UNTITLED_THREAD_TITLE;
  }

  const index = Math.floor(random() * availableTitles.length);
  return availableTitles[index] ?? DEFAULT_UNTITLED_THREAD_TITLE;
}

/**
 * Generates a thread title based on the first user message.
 * Uses the first few words of the message, capped at a reasonable length.
 */
export function generateThreadTitleFromMessage(messageText: string): string {
  const MAX_TITLE_LENGTH = 30;
  const WORDS_TO_INCLUDE = 5;

  const trimmed = messageText.trim();
  if (!trimmed) {
    return DEFAULT_UNTITLED_THREAD_TITLE;
  }

  // Take first N words and join them
  const words = trimmed.split(/\s+/).slice(0, WORDS_TO_INCLUDE);
  let title = words.join(" ");

  // If the title is too long, truncate it and add ellipsis
  if (title.length > MAX_TITLE_LENGTH) {
    title = `${title.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
  }

  // Capitalize the first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

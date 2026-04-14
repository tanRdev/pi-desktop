import type { LinkColor } from "@pi-desktop/shared";

const LINK_COLORS: LinkColor[] = [
  "blue",
  "green",
  "orange",
  "pink",
  "purple",
  "yellow",
];

const LINK_COLOR_HEX: Record<LinkColor, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  orange: "#f97316",
  pink: "#ec4899",
  purple: "#a855f7",
  yellow: "#eab308",
};

export function getLinkColorForId(id: string): LinkColor {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(index);
    hash |= 0;
  }

  const normalizedIndex = Math.abs(hash) % LINK_COLORS.length;
  return LINK_COLORS[normalizedIndex] ?? "blue";
}

export function getLinkColorHex(color: LinkColor): string {
  return LINK_COLOR_HEX[color];
}

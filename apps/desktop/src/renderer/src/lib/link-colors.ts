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
  blue: "#7FB3D9",
  green: "#5FB87A",
  orange: "#D9955F",
  pink: "#D97FA8",
  purple: "#A88FD9",
  yellow: "#D9C57F",
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

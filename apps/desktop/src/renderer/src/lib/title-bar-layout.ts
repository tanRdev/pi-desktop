export function getTrafficLightInset(platform: string | null): number {
  if (platform === "darwin") {
    return 16;
  }

  return 12;
}

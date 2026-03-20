interface TitleBarLeftPaddingInput {
  isFullscreen: boolean;
  platform: NodeJS.Platform | string | null;
}

export function getTitleBarLeftPadding({
  isFullscreen,
  platform,
}: TitleBarLeftPaddingInput): number {
  if (isFullscreen) {
    return 24;
  }

  if (platform === "darwin") {
    return 88;
  }

  return 16;
}

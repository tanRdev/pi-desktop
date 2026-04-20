export type NavRing = {
  focusNext: () => string;
  focusPrevious: () => string;
  focusRegion: (id: string) => string;
  currentRegion: string;
  regions: ReadonlyArray<string>;
};

export function createNavRing(regions: string[]): NavRing {
  if (regions.length === 0) {
    throw new Error("createNavRing requires at least one region");
  }

  const regionList = Object.freeze([...regions]);
  let currentIndex = 0;

  function regionAt(index: number): string {
    const region = regionList[index];
    if (region === undefined) {
      throw new Error(`Region index ${index} out of bounds`);
    }
    return region;
  }

  function wrapIndex(index: number): number {
    const len = regionList.length;
    return ((index % len) + len) % len;
  }

  return {
    focusNext() {
      currentIndex = wrapIndex(currentIndex + 1);
      return regionAt(currentIndex);
    },

    focusPrevious() {
      currentIndex = wrapIndex(currentIndex - 1);
      return regionAt(currentIndex);
    },

    focusRegion(id: string) {
      const found = regionList.indexOf(id);
      if (found === -1) {
        throw new Error(`Unknown region: ${id}`);
      }
      currentIndex = found;
      return regionAt(currentIndex);
    },

    get currentRegion(): string {
      return regionAt(currentIndex);
    },

    get regions(): ReadonlyArray<string> {
      return regionList;
    },
  };
}

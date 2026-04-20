export interface CharDiffResult {
  prefix: string;
  oldMiddle: string;
  newMiddle: string;
  suffix: string;
}

export function computeCharDiff(
  oldLine: string,
  newLine: string,
): CharDiffResult {
  const minLen = Math.min(oldLine.length, newLine.length);

  let prefixLen = 0;
  while (prefixLen < minLen && oldLine[prefixLen] === newLine[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldLine[oldLine.length - 1 - suffixLen] ===
      newLine[newLine.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  return {
    prefix: oldLine.slice(0, prefixLen),
    oldMiddle: oldLine.slice(prefixLen, oldLine.length - suffixLen),
    newMiddle: newLine.slice(prefixLen, newLine.length - suffixLen),
    suffix: suffixLen > 0 ? oldLine.slice(oldLine.length - suffixLen) : "",
  };
}

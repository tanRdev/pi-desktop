import { useEffect, useState } from "react";
import type { BrailleSpinnerName } from "unicode-animations";
import spinners from "unicode-animations";

/**
 * Cycles through unicode-animations braille spinner frames.
 * Returns the current frame string. Only ticks while `active` is true.
 */
export function useUnicodeSpinner(
  name: BrailleSpinnerName,
  active: boolean,
): string {
  const spinner = spinners[name];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }

    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % spinner.frames.length);
    }, spinner.interval);

    return () => clearInterval(id);
  }, [active, spinner]);

  if (!active) {
    return spinner.frames[0] ?? "";
  }

  return spinner.frames[index] ?? "";
}

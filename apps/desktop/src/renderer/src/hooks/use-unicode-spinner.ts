import { useEffect, useState } from "react";
import type { BrailleSpinnerName, Spinner } from "unicode-animations";
import spinners from "unicode-animations";

/**
 * Cycles through unicode-animations braille spinner frames or custom frames.
 * Returns the current frame string. Only ticks while `active` is true.
 */
export function useUnicodeSpinner(
  spinnerOrName: BrailleSpinnerName | Spinner,
  active: boolean,
): string {
  const spinner =
    typeof spinnerOrName === "string" ? spinners[spinnerOrName] : spinnerOrName;
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

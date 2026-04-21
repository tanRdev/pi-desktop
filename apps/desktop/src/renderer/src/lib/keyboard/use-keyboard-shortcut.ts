import { useEffect, useRef } from "react";
import {
  globalShortcutRegistry,
  type ShortcutDefinition,
  type ShortcutRegistry,
} from "./shortcut-registry";

export type UseKeyboardShortcutOptions = Omit<ShortcutDefinition, "run"> & {
  registry?: ShortcutRegistry;
};

/**
 * Registers a keyboard shortcut against the global registry for the lifetime of the component.
 * The callback is stored in a ref so consumers don't need to memoize it.
 */
export function useKeyboardShortcut(
  options: UseKeyboardShortcutOptions,
  callback: (event: KeyboardEvent) => void,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Hold the latest options in a ref so only the id + a stable signature drive re-registration.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const activeRegistry = options.registry ?? globalShortcutRegistry;
  const { id } = options;
  const keysSignature = Array.isArray(options.keys)
    ? options.keys.join("|")
    : options.keys;

  useEffect(() => {
    const current = optionsRef.current;
    // Reference id + keysSignature so biome's dependency analysis sees them used.
    void id;
    void keysSignature;
    const unregister = activeRegistry.register({
      id: current.id,
      keys: current.keys,
      description: current.description,
      group: current.group,
      // Dynamic predicates & flags read through the ref so the latest values are used
      // without forcing unregister/register on every option change.
      when: () => {
        const w = optionsRef.current.when;
        return w === undefined ? true : w();
      },
      allowInInput: current.allowInInput,
      preventDefault: current.preventDefault,
      stopPropagation: current.stopPropagation,
      run: (event) => callbackRef.current(event),
    });
    return unregister;
  }, [activeRegistry, id, keysSignature]);
}

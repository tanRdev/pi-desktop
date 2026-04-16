import { vi } from "vitest";

/**
 * Install a partial `window.piDesktop` mock for a test.
 *
 * Unspecified methods become `vi.fn()` returning `undefined`.
 * Returns the installed proxy so tests can read `.fs.readDirectory.mock.calls`.
 *
 * Access via `window.piDesktop.someNamespace.someMethod` in the code under test
 * will resolve through the proxy to a `vi.fn()` unless you provide an override.
 *
 * @example
 *   const api = installMockPiDesktop({
 *     fs: {
 *       readDirectory: vi.fn(() =>
 *         Promise.resolve({ path: "/tmp", entries: [] }),
 *       ),
 *     },
 *   });
 *   // ...render hook...
 *   expect(api.fs.readDirectory).toHaveBeenCalledWith("/tmp");
 */
export type MockPiDesktop = {
  [namespace: string]: {
    [method: string]: ReturnType<typeof vi.fn>;
  };
};

export function installMockPiDesktop(
  overrides: Record<string, Record<string, unknown>> = {},
): MockPiDesktop {
  const namespaceCache = new Map<
    string,
    Record<string, ReturnType<typeof vi.fn>>
  >();

  function makeNamespace(
    name: string,
  ): Record<string, ReturnType<typeof vi.fn>> {
    const existing = namespaceCache.get(name);
    if (existing) return existing;

    const namespaceOverrides = overrides[name] ?? {};
    const fns: Record<string, ReturnType<typeof vi.fn>> = {};

    for (const [method, impl] of Object.entries(namespaceOverrides)) {
      if (typeof impl === "function") {
        const fn: (...args: unknown[]) => unknown = (...args) => impl(...args);
        fns[method] = vi.fn(fn);
      } else {
        fns[method] = vi.fn(() => impl);
      }
    }

    const proxy = new Proxy(fns, {
      get(target, prop) {
        if (typeof prop !== "string") return undefined;
        if (!(prop in target)) {
          target[prop] = vi.fn();
        }
        return target[prop];
      },
    });

    namespaceCache.set(name, proxy);
    return proxy;
  }

  const api: MockPiDesktop = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        return makeNamespace(prop);
      },
    },
  );

  Object.defineProperty(window, "piDesktop", {
    configurable: true,
    writable: true,
    value: api,
  });

  return api;
}

/** Convenience: uninstall between suites (optional; configurable overwrites). */
export function uninstallMockPiDesktop(): void {
  Object.defineProperty(window, "piDesktop", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

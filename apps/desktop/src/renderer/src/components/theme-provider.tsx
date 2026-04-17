import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

function applyThemeClass(theme: ResolvedTheme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ResolvedTheme>(() => readSystemTheme());

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mql = window.matchMedia(DARK_MEDIA_QUERY);
    const handle = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };
    mql.addEventListener("change", handle);
    return () => {
      mql.removeEventListener("change", handle);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

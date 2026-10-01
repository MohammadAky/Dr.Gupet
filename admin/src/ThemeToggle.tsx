import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const storageKey = "drgupet.theme.v1";

function initialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be disabled; the control still works for this visit.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch {
      // A storage failure must not block changing the visible theme.
    }
  }, [theme]);

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={theme === "dark" ? "فعال کردن حالت روشن" : "فعال کردن حالت تاریک"}
      aria-pressed={theme === "dark"}
      title={theme === "dark" ? "حالت روشن" : "حالت تاریک"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
        <g className="theme-sun" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </g>
        <path className="theme-moon" d="M20.3 15.8A8.5 8.5 0 0 1 8.2 3.7a8.5 8.5 0 1 0 12.1 12.1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

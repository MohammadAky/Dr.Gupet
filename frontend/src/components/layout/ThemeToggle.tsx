import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const THEME_KEY = 'dr-gupet-theme';

function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private browsing can disable storage; the system preference still works.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggle() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // Keep the theme active for this visit if storage is unavailable.
    }
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={theme === 'light' ? 'فعال کردن حالت تاریک' : 'فعال کردن حالت روشن'}
      aria-pressed={theme === 'dark'}
      title={theme === 'light' ? 'حالت تاریک' : 'حالت روشن'}
      onClick={toggle}
    >
      <span className="theme-toggle__sky" aria-hidden="true">
        <svg
          className="theme-toggle__sun"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
        <svg
          className="theme-toggle__moon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.6 15.1A8.7 8.7 0 0 1 8.9 3.4 8.8 8.8 0 1 0 20.6 15.1Z" />
        </svg>
      </span>
    </button>
  );
}

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'curalink-theme-mode';
const THEME_OPTIONS = ['system', 'light', 'dark'];

function getSystemTheme() {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function readStoredMode() {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return THEME_OPTIONS.includes(stored) ? stored : 'system';
}

export function useTheme() {
  const [mode, setMode] = useState(readStoredMode);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (event) => {
      setSystemTheme(event.matches ? 'light' : 'dark');
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const activeTheme = useMemo(() => (mode === 'system' ? systemTheme : mode), [mode, systemTheme]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.style.colorScheme = activeTheme;
  }, [activeTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  return {
    mode,
    setMode,
    activeTheme,
    options: THEME_OPTIONS,
  };
}

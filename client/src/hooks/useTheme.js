import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'curalink-theme-mode';
const THEME_OPTIONS = ['system', 'light', 'dark'];

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function readStoredMode() {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return THEME_OPTIONS.includes(stored) ? stored : 'system';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  // Enable Tailwind dark: variants
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  const [mode, setMode] = useState(readStoredMode);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => setSystemTheme(e.matches ? 'light' : 'dark');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  const activeTheme = useMemo(
    () => (mode === 'system' ? systemTheme : mode),
    [mode, systemTheme]
  );

  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode]);

  return { mode, setMode, activeTheme, options: THEME_OPTIONS };
}

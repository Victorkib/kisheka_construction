'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Theme modes stored in user preference
 * - 'system': follow OS preference
 * - 'light' | 'dark': explicit override
 */
const ThemeContext = createContext(null);

const STORAGE_KEY = 'kisheka_theme_mode';

function getSystemPreference() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(mode) {
  if (mode === 'system') {
    return getSystemPreference();
  }
  return mode;
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('system');
  const [theme, setTheme] = useState('light');

  // Initialise from localStorage / system on first client render
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const initialMode = stored === 'light' || stored === 'dark' || stored === 'system'
        ? stored
        : 'system';
      const initialTheme = resolveTheme(initialMode);

      setMode(initialMode);
      setTheme(initialTheme);

      const root = window.document.documentElement;
      root.dataset.theme = initialTheme;

      // If using system, listen for OS preference changes
      if (initialMode === 'system' && window.matchMedia) {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (event) => {
          const nextTheme = event.matches ? 'dark' : 'light';
          setTheme(nextTheme);
          root.dataset.theme = nextTheme;
        };
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
      }
    } catch (error) {
      // If anything goes wrong, fall back to light without breaking the app
      console.error('Error initialising theme mode:', error);
    }
  }, []);

  const updateMode = (nextMode) => {
    if (typeof window === 'undefined') return;
    const normalized =
      nextMode === 'light' || nextMode === 'dark' || nextMode === 'system'
        ? nextMode
        : 'system';

    const resolved = resolveTheme(normalized);
    setMode(normalized);
    setTheme(resolved);

    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }

    const root = window.document.documentElement;
    root.dataset.theme = resolved;
  };

  const toggleTheme = () => {
    // Only toggles between explicit light/dark, does not go back to system
    const next = theme === 'light' ? 'dark' : 'light';
    updateMode(next);
  };

  const value = useMemo(
    () => ({
      theme,
      mode,
      setMode: updateMode,
      toggleTheme,
      isDark: theme === 'dark',
      isLight: theme === 'light',
    }),
    [theme, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}


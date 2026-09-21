import { create } from 'zustand';

// Light/dark preference. Two states rather than three: the OS preference is
// the starting point, but once someone picks, their choice sticks rather than
// being quietly overridden the next time their laptop switches at sunset.
//
// The class is applied before first paint by the inline script in index.html;
// this store keeps React in step with it and handles changes afterwards.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'geartrack:theme';

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function readInitial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can throw outright in private browsing; fall through.
  }
  return systemPrefersDark() ? 'dark' : 'light';
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface ThemeState {
  theme: Theme;
}

export const useThemeStore = create<ThemeState>(() => ({ theme: readInitial() }));

// Re-assert on load. The inline script should already have done this, but if
// it was blocked or threw, this keeps the DOM and the store from disagreeing.
apply(useThemeStore.getState().theme);

export function setTheme(theme: Theme) {
  useThemeStore.setState({ theme });
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice just won't survive a reload; the page is still correct now.
  }
}

export function toggleTheme() {
  setTheme(useThemeStore.getState().theme === 'dark' ? 'light' : 'dark');
}

export function useTheme(): Theme {
  return useThemeStore((s) => s.theme);
}

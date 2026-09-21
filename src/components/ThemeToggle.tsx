import { Sun, Moon } from 'lucide-react';
import { useTheme, toggleTheme } from '../store/theme';

// Deliberately quiet: a single icon beside Sign out, no label and no border.
// This is a setting people change once, so it earns a corner rather than a
// permanent block of contrast next to the navigation.
//
// The icon shows the mode you would switch TO, not the one you are in — the
// usual ambiguity with a lone moon — and the title and aria-label say so
// outright, so nothing depends on guessing the convention.
export default function ThemeToggle() {
  const theme = useTheme();
  const goingDark = theme === 'light';
  const Icon = goingDark ? Moon : Sun;
  const label = goingDark ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className="text-ink-faint transition-colors hover:text-ink"
    >
      <Icon size={16} />
    </button>
  );
}

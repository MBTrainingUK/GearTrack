import { Sun, Moon } from 'lucide-react';
import { useTheme, setTheme } from '../store/theme';

// A two-state switch rather than a single icon button: it shows which mode is
// active, instead of leaving people to work out whether the moon means "you
// are in dark" or "click for dark".
export default function ThemeToggle() {
  const theme = useTheme();

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="flex w-full rounded-lg border border-line bg-surface p-0.5"
    >
      {(['light', 'dark'] as const).map((choice) => {
        const active = theme === choice;
        const Icon = choice === 'light' ? Sun : Moon;
        return (
          <button
            key={choice}
            type="button"
            onClick={() => setTheme(choice)}
            aria-pressed={active}
            title={choice === 'light' ? 'Light mode' : 'Dark mode'}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-surface-hover text-ink'
                : 'text-ink-faint hover:text-ink-body'
            }`}
          >
            <Icon size={13} />
            {choice === 'light' ? 'Light' : 'Dark'}
          </button>
        );
      })}
    </div>
  );
}

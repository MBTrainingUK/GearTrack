import { useTheme } from '../store/theme';

// Recharts takes its colours as props, not classes, so the Tailwind tokens
// can't reach it. These are the same values by hand, picked from the palette
// in index.css so the charts sit in the page rather than on top of it.
//
// Series fills are deliberately absent: the saturated 500-weight blues and
// greens read correctly on both backgrounds and don't need swapping.
export interface ChartTheme {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

export function useChartTheme(): ChartTheme {
  const dark = useTheme() === 'dark';
  return dark
    ? {
        grid: '#2b313c',        // --gt-line
        axis: '#8b93a1',        // --gt-ink-muted
        tooltipBg: '#1f232c',   // --gt-surface-hover, lifted off the card
        tooltipBorder: '#2b313c',
        tooltipText: '#e8eaee', // --gt-ink
      }
    : {
        grid: '#f0f0f0',
        axis: '#6b7280',
        tooltipBg: '#ffffff',
        tooltipBorder: '#e5e7eb',
        tooltipText: '#111827',
      };
}

// Spread onto <Tooltip /> — Recharts renders its own panel, which would
// otherwise stay white with dark text in the middle of a dark page.
export function tooltipProps(t: ChartTheme) {
  return {
    contentStyle: {
      backgroundColor: t.tooltipBg,
      border: `1px solid ${t.tooltipBorder}`,
      borderRadius: 10,
      color: t.tooltipText,
      fontSize: 12,
    },
    labelStyle: { color: t.tooltipText },
    itemStyle: { color: t.tooltipText },
    cursor: { fill: t.grid, fillOpacity: 0.35 },
  };
}

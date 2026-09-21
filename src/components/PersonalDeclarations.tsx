import { AVAILABILITY_DECLARATION, LIABILITY_DECLARATION } from '../lib/checkout';

interface Props {
  availabilityChecked: boolean;
  liabilityAccepted: boolean;
  onAvailabilityChange: (checked: boolean) => void;
  onLiabilityChange: (checked: boolean) => void;
}

// The two declarations behind every personal booking, shared by the checkout
// modal and the reservation form so the wording can only ever be changed in one
// place — an acceptance recorded on one screen must mean the same as the other.
export default function PersonalDeclarations({
  availabilityChecked,
  liabilityAccepted,
  onAvailabilityChange,
  onLiabilityChange,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink-label">Declarations *</p>

      <label
        className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors ${availabilityChecked ? 'border-purple-300 dark:border-purple-500/40 bg-purple-50/60' : 'border-line hover:bg-surface-hover'}`}
      >
        <input
          type="checkbox"
          checked={availabilityChecked}
          onChange={(e) => onAvailabilityChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-purple-600 dark:text-purple-400 focus:ring-purple-500"
        />
        <span className="text-xs leading-relaxed text-ink-label">
          {AVAILABILITY_DECLARATION.intro}
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {AVAILABILITY_DECLARATION.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <span className="mt-1.5 block font-medium text-ink">
            {AVAILABILITY_DECLARATION.accept}
          </span>
        </span>
      </label>

      <label
        className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors ${liabilityAccepted ? 'border-purple-300 dark:border-purple-500/40 bg-purple-50/60' : 'border-line hover:bg-surface-hover'}`}
      >
        <input
          type="checkbox"
          checked={liabilityAccepted}
          onChange={(e) => onLiabilityChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-purple-600 dark:text-purple-400 focus:ring-purple-500"
        />
        <span className="text-xs leading-relaxed text-ink-label">
          {LIABILITY_DECLARATION.text}
          <span className="mt-1.5 block font-medium text-ink">
            {LIABILITY_DECLARATION.accept}
          </span>
        </span>
      </label>
    </div>
  );
}

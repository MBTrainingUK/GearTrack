import { AlertTriangle } from 'lucide-react';

type ItemCondition = 'good' | 'needs_attention' | 'damaged';

export default function ConditionBadge({ condition }: { condition?: ItemCondition | string }) {
  if (!condition || condition === 'good') return null;
  if (condition === 'needs_attention') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertTriangle size={11} />
        Needs attention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <AlertTriangle size={11} />
      Damaged
    </span>
  );
}

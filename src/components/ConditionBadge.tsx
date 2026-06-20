import { AlertTriangle, Search } from 'lucide-react';

type ItemCondition = 'good' | 'attention_needed' | 'needs_investigating' | 'damaged';

export default function ConditionBadge({ condition }: { condition?: ItemCondition | string }) {
  if (!condition || condition === 'good') return null;
  if (condition === 'attention_needed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertTriangle size={11} />
        Attention needed
      </span>
    );
  }
  if (condition === 'needs_investigating') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
        <Search size={11} />
        Needs investigating
      </span>
    );
  }
  if (condition === 'damaged') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <AlertTriangle size={11} />
        Damaged
      </span>
    );
  }
  return null;
}

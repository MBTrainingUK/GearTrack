import { useNavigate } from 'react-router-dom';
import { X, ShoppingBasket, CalendarRange, ArrowLeftRight, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { useBasket, removeFromBasket, clearBasket } from '../store/basket';

export default function BasketDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { entries, ids, count, availableNow } = useBasket();

  if (!open) return null;

  // Both routes hand the basket to an existing screen rather than booking
  // anything here — every approval, conflict and declaration rule stays where
  // it already lives.
  function reserveForLater() {
    onClose();
    navigate(`/reservations/new?itemIds=${ids.join(',')}`);
  }

  function checkOutNow() {
    if (availableNow.length === 0) return;
    onClose();
    navigate(`/checkouts?itemIds=${availableNow.map((i) => i.id).join(',')}`);
  }

  const someUnavailable = availableNow.length < count;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <ShoppingBasket size={18} className="text-blue-600 dark:text-blue-400" />
            Basket
            {count > 0 && <span className="text-sm font-normal text-ink-muted">({count})</span>}
          </h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-body">
            <X size={18} />
          </button>
        </div>

        {count === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBasket size={36} className="text-ink-ghost" />
            <p className="text-sm text-ink-muted">The basket is empty</p>
            <p className="text-xs text-ink-faint">
              Add gear from the Items page, then reserve it for a future date or check it out
              straight away.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto divide-y divide-line-subtle">
              {entries.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {item.category}
                      {item.assetNumber && <span className="ml-2">· Asset: {item.assetNumber}</span>}
                    </p>
                  </div>
                  <StatusBadge status={item.status} type="item" className="shrink-0" />
                  <button
                    onClick={() => removeFromBasket(item.id)}
                    title="Remove from basket"
                    className="shrink-0 text-ink-ghost hover:text-red-500 dark:hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-line-subtle px-5 py-4">
              {someUnavailable && (
                <p className="text-xs text-ink-muted">
                  {count - availableNow.length} of {count} {count - availableNow.length === 1 ? 'is' : 'are'}{' '}
                  out right now — still bookable for a future date.
                </p>
              )}
              <button
                onClick={reserveForLater}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <CalendarRange size={15} />
                Reserve for later
                <span className="text-xs font-normal text-blue-100">all {count}</span>
              </button>
              <button
                onClick={checkOutNow}
                disabled={availableNow.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-label hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeftRight size={15} />
                Check out now
                <span className="text-xs font-normal text-ink-faint">
                  {availableNow.length === count ? `all ${count}` : `${availableNow.length} of ${count}`}
                </span>
              </button>
              <button
                onClick={clearBasket}
                className="w-full py-1 text-xs text-ink-faint hover:text-red-500 dark:hover:text-red-400"
              >
                Empty basket
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

import type { ReactNode } from 'react';
import { errorText } from '../lib/labels';

/** Loading / error / empty primitives shared by every data view (convention §5.10). */

export function LoadingState({ text = 'در حال بارگذاری…' }: { text?: string }) {
  return (
    <p role="status" aria-busy="true">
      {text}
    </p>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="state-error">
      <p>{errorText(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          تلاش دوباره
        </button>
      )}
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="state-empty">
      <p>{text}</p>
      {action}
    </div>
  );
}

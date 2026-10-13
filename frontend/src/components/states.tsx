import type { ReactNode } from 'react';
import { errorText } from '../lib/labels';
import { PageSkeleton, type LoadingLayout } from './RouteLoading';

/** Loading / error / empty primitives shared by every data view (convention §5.10). */

export function LoadingState({ text, layout }: { text?: string; layout?: LoadingLayout }) {
  // Small in-place operations retain their compact status; page data reserves its outline.
  if (!text || layout) return <PageSkeleton layout={layout} text={text} />;
  return (
    <p className="state-loading" role="status" aria-busy="true">
      <span className="state-loading__indicator" aria-hidden="true" />
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

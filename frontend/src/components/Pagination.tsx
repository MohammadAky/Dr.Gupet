import { useSearchParams } from 'react-router-dom';
import type { PageInfo } from '../api/types';

/** Page-based pagination (README §6.4 — limit never exceeds 50). */
export function Pagination({ meta }: { meta?: PageInfo }) {
  const [params, setParams] = useSearchParams();
  if (!meta || meta.totalPages <= 1) return null;

  const current = meta.page;

  function goTo(page: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
  }

  return (
    <nav className="pagination" aria-label="صفحه‌بندی">
      <button type="button" disabled={current <= 1} onClick={() => goTo(current - 1)}>
        قبلی
      </button>
      <span dir="ltr">
        {current} / {meta.totalPages}
      </span>
      <button type="button" disabled={current >= meta.totalPages} onClick={() => goTo(current + 1)}>
        بعدی
      </button>
    </nav>
  );
}

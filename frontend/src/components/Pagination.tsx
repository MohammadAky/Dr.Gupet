import { useSearchParams } from 'react-router-dom';
import type { PageInfo } from '../api/types';
import { toFaDigits } from '../lib/format';

/** Page-based pagination (README §6.4 — limit never exceeds 50). */
export function Pagination({ meta, busy = false }: { meta?: PageInfo; busy?: boolean }) {
  const [params, setParams] = useSearchParams();
  if (!meta || meta.totalPages <= 1) return null;

  const current = meta.page;

  function goTo(page: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
  }

  return (
    <nav className="pagination" aria-label="صفحه‌بندی" aria-busy={busy}>
      <button type="button" disabled={busy || current <= 1} onClick={() => goTo(current - 1)}>
        قبلی
      </button>
      <span role="status">
        صفحهٔ {toFaDigits(String(current))} از {toFaDigits(String(meta.totalPages))}
      </span>
      <button type="button" disabled={busy || current >= meta.totalPages} onClick={() => goTo(current + 1)}>
        بعدی
      </button>
    </nav>
  );
}

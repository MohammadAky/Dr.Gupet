// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import { Pagination } from './Pagination';
it('announces Persian page numbers, preserves filters, and blocks stale pagination while fetching', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  function Page({ busy }: { busy: boolean }) {
    const [params] = useSearchParams();
    return <><Pagination meta={{ page: 2, totalPages: 4, limit: 20, total: 80 }} busy={busy} /><output>{params.toString()}</output></>;
  }
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/products?q=food&page=2']}><Page busy /></MemoryRouter>));
    expect(container.querySelector('[role="status"]')?.textContent).toBe('صفحهٔ ۲ از ۴');
    const next = container.querySelectorAll<HTMLButtonElement>('button')[1]!;
    expect(next.disabled).toBe(true);
    await act(async () => next.click()); expect(container.querySelector('output')?.textContent).toBe('q=food&page=2');
    await act(async () => root.render(<MemoryRouter initialEntries={['/products?q=food&page=2']}><Page busy={false} /></MemoryRouter>));
    await act(async () => next.click()); expect(container.querySelector('output')?.textContent).toBe('q=food&page=3');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});

// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import type { Pet } from '../api/types';
import { PetsPage } from './PetsPage';

const authState = vi.hoisted(() => ({ userId: 1, status: 'authed' }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ status: authState.status, user: { id: authState.userId } }) }));
vi.mock('../api/endpoints', () => ({ api: { listPets: vi.fn(), deletePet: vi.fn() } }));

const pet: Pet = {
  id: 5, userId: 1, name: 'باران', petTypeId: 1, breedId: null, birthDate: null,
  gender: null, isNeutered: false, weightKg: null, photo: null, deletedAt: null,
  createdAt: '', updatedAt: '', petType: { id: 1, name: 'سگ', slug: 'dog' },
  breed: null, tags: [], lifeStage: 'ADULT',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

describe('pets list mutations', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  async function renderPage(waitForItems = true) {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><MemoryRouter><PetsPage /></MemoryRouter></QueryClientProvider>);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    if (waitForItems) await vi.waitFor(() => expect(container.querySelector('button')).not.toBeNull());
  }

  beforeEach(() => {
    authState.userId = 1;
    authState.status = 'authed';
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
    vi.mocked(api.listPets).mockResolvedValue([pet]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps confirmation and blocks duplicate deletes while showing errors in the page', async () => {
    const pending = deferred<void>();
    vi.mocked(api.deletePet).mockReturnValue(pending.promise);
    await renderPage();
    const remove = container.querySelector<HTMLButtonElement>('li button')!;
    await act(async () => { remove.click(); remove.click(); });
    expect(window.confirm).toHaveBeenCalledWith('«باران» حذف شود؟');
    expect(api.deletePet).toHaveBeenCalledTimes(1);
    expect(remove.disabled).toBe(true);
    await act(async () => pending.reject(new Error('حذف انجام نشد')));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('حذف انجام نشد');
    expect(window.alert).not.toHaveBeenCalled();
    expect(remove.disabled).toBe(false);
  });

  it('shows success only after the real delete and refreshed list', async () => {
    vi.mocked(api.listPets).mockResolvedValueOnce([pet]).mockResolvedValueOnce([]);
    vi.mocked(api.deletePet).mockResolvedValue(undefined);
    await renderPage();
    await act(async () => container.querySelector<HTMLButtonElement>('li button')?.click());
    await vi.waitFor(() => expect(container.querySelector('[role="status"]')?.textContent).toBe('حیوان حذف شد.'));
    expect(api.listPets).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('هنوز حیوان خانگی ثبت نکرده‌اید.');
  });

  it('ignores a late delete after the account changes', async () => {
    const pending = deferred<void>();
    vi.mocked(api.deletePet).mockReturnValue(pending.promise);
    await renderPage();
    await act(async () => container.querySelector<HTMLButtonElement>('li button')?.click());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    authState.userId = 2;
    await renderPage();
    await act(async () => pending.resolve(undefined));
    expect(invalidate).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('does not fetch or write private data for a guest', async () => {
    authState.status = 'guest';
    await renderPage(false);
    expect(api.listPets).not.toHaveBeenCalled();
    expect(api.deletePet).not.toHaveBeenCalled();
    expect(container.textContent).toContain('وارد حساب شوید');
  });

  it('does not refill the private cache when a list response arrives after logout', async () => {
    const pending = deferred<Pet[]>();
    vi.mocked(api.listPets).mockReturnValue(pending.promise);
    await renderPage(false);
    expect(api.listPets).toHaveBeenCalledTimes(1);
    authState.status = 'guest';
    await renderPage(false);
    await act(async () => pending.resolve([pet]));
    expect(client.getQueryData(queryKeys.pets)).toBeUndefined();
    expect(container.textContent).not.toContain('باران');
  });
});

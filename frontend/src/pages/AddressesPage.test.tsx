// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import type { Address } from '../api/types';
import { AddressesPage } from './AddressesPage';

const authState = vi.hoisted(() => ({ userId: 1, status: 'authed' }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ status: authState.status, user: { id: authState.userId } }) }));
vi.mock('../api/endpoints', () => ({ api: {
  listAddresses: vi.fn(), setDefaultAddress: vi.fn(), deleteAddress: vi.fn(),
} }));

const first: Address = {
  id: 10, userId: 1, title: 'خانه', receiverName: 'کاربر', receiverPhone: '09120000000',
  province: 'تهران', city: 'تهران', fullAddress: 'خیابان اول', postalCode: null,
  lat: null, lng: null, isDefault: true, createdAt: '', updatedAt: '',
};
const second: Address = { ...first, id: 11, title: 'محل کار', isDefault: false };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

describe('address book mutations', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  async function renderPage(waitForItems = true) {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><MemoryRouter><AddressesPage /></MemoryRouter></QueryClientProvider>);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    if (waitForItems) await vi.waitFor(() => expect(container.querySelector('li[data-default]')).not.toBeNull());
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
    vi.mocked(api.listAddresses).mockResolvedValue([first, second]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('locks both writes during default change and shows an inline failure', async () => {
    const pending = deferred<Address>();
    vi.mocked(api.setDefaultAddress).mockReturnValue(pending.promise);
    await renderPage();
    const changeDefault = container.querySelector<HTMLButtonElement>('li[data-default="false"] button')!;
    const deletes = [...container.querySelectorAll<HTMLButtonElement>('li[data-default] button')].filter((button) => button.textContent === 'حذف');
    await act(async () => { changeDefault.click(); changeDefault.click(); deletes[0]?.click(); });
    expect(api.setDefaultAddress).toHaveBeenCalledTimes(1);
    expect(api.deleteAddress).not.toHaveBeenCalled();
    expect(changeDefault.disabled).toBe(true);
    expect(deletes.every((button) => button.disabled)).toBe(true);
    await act(async () => pending.reject(new Error('تغییر آدرس انجام نشد')));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('تغییر آدرس انجام نشد');
    expect(window.alert).not.toHaveBeenCalled();
    expect(changeDefault.disabled).toBe(false);
  });

  it('honors delete cancellation then shows success after the server refresh', async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.mocked(api.listAddresses).mockResolvedValueOnce([first, second]).mockResolvedValueOnce([first]);
    vi.mocked(api.deleteAddress).mockResolvedValue(undefined);
    await renderPage();
    const deleteSecond = [...container.querySelectorAll<HTMLButtonElement>('li[data-default="false"] button')].find((button) => button.textContent === 'حذف')!;
    await act(async () => deleteSecond.click());
    expect(api.deleteAddress).not.toHaveBeenCalled();
    await act(async () => deleteSecond.click());
    expect(api.deleteAddress).toHaveBeenCalledWith(11);
    await vi.waitFor(() => expect(container.querySelector('[role="status"]')?.textContent).toBe('آدرس حذف شد.'));
    expect(api.listAddresses).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('محل کار');
  });

  it('does not invalidate new account data when an old delete settles late', async () => {
    const pending = deferred<void>();
    vi.mocked(api.deleteAddress).mockReturnValue(pending.promise);
    await renderPage();
    const deleteSecond = [...container.querySelectorAll<HTMLButtonElement>('li[data-default="false"] button')].find((button) => button.textContent === 'حذف')!;
    await act(async () => deleteSecond.click());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    authState.userId = 2;
    await renderPage();
    await act(async () => pending.resolve(undefined));
    expect(invalidate).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('does not fetch or mutate addresses for a guest', async () => {
    authState.status = 'guest';
    await renderPage(false);
    expect(api.listAddresses).not.toHaveBeenCalled();
    expect(api.setDefaultAddress).not.toHaveBeenCalled();
    expect(api.deleteAddress).not.toHaveBeenCalled();
  });

  it('discards a list response after logout instead of refilling private cache', async () => {
    const pending = deferred<Address[]>();
    vi.mocked(api.listAddresses).mockReturnValue(pending.promise);
    await renderPage(false);
    expect(api.listAddresses).toHaveBeenCalledTimes(1);
    authState.status = 'guest';
    await renderPage(false);
    await act(async () => pending.resolve([first, second]));
    expect(client.getQueryData(queryKeys.addresses)).toBeUndefined();
    expect(container.textContent).not.toContain('خیابان اول');
  });
});

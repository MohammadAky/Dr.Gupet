// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { tokenStorage } from '../lib/storage';
import { AuthProvider, useAuth } from './auth-provider';

vi.mock('../api/client', () => ({ setAuthBridge: vi.fn() }));
vi.mock('../api/endpoints', () => ({
  api: { refresh: vi.fn(), me: vi.fn(), verifyOtp: vi.fn(), logout: vi.fn() },
}));

const profile = {
  id: 1,
  firstName: 'کاربر',
  lastName: null,
  phone: '09123456789',
  avatar: null,
  role: 'USER' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function Probe() {
  const { status, verifyOtp, logout } = useAuth();
  return (
    <div>
      <output>{status}</output>
      <button onClick={() => void verifyOtp('09123456789', '12345')}>verify</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider identity boundaries', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.me).mockResolvedValue(profile);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('rotates a persisted token only once when StrictMode replays bootstrap', async () => {
    tokenStorage.set('old-refresh');
    let finishRefresh!: (pair: { accessToken: string; refreshToken: string }) => void;
    vi.mocked(api.refresh).mockReturnValue(
      new Promise((resolve) => {
        finishRefresh = resolve;
      }),
    );

    await act(async () => {
      root.render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <Probe />
            </AuthProvider>
          </QueryClientProvider>
        </StrictMode>,
      );
    });
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(api.refresh).toHaveBeenCalledWith('old-refresh');

    await act(async () =>
      finishRefresh({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
    );
    expect(tokenStorage.get()).toBe('new-refresh');
    expect(container.querySelector('output')?.textContent).toBe('authed');
  });

  it('removes the previous identity cache before OTP login completes', async () => {
    queryClient.setQueryData(queryKeys.cart, { items: [{ id: 9 }], itemsTotal: 100 });
    queryClient.setQueryData(queryKeys.addresses, [{ id: 3 }]);
    vi.mocked(api.verifyOtp).mockResolvedValue({
      accessToken: 'account-b-access',
      refreshToken: 'account-b-refresh',
      user: { ...profile, status: 'ACTIVE', isPhoneVerified: true },
      isNewUser: false,
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Probe />
          </AuthProvider>
        </QueryClientProvider>,
      );
    });
    await act(async () => container.querySelector('button')?.click());

    expect(queryClient.getQueryData(queryKeys.cart)).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.addresses)).toBeUndefined();
    expect(tokenStorage.get()).toBe('account-b-refresh');
    expect(container.querySelector('output')?.textContent).toBe('authed');
  });

  it('clears account data on logout', async () => {
    vi.mocked(api.verifyOtp).mockResolvedValue({
      accessToken: 'account-a-access',
      refreshToken: 'account-a-refresh',
      user: { ...profile, status: 'ACTIVE', isPhoneVerified: true },
      isNewUser: false,
    });
    vi.mocked(api.logout).mockResolvedValue({ ok: true });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Probe />
          </AuthProvider>
        </QueryClientProvider>,
      );
    });
    await act(async () => container.querySelectorAll('button')[0]?.click());
    queryClient.setQueryData(queryKeys.cart, { items: [{ id: 9 }], itemsTotal: 100 });
    queryClient.setQueryData(queryKeys.pets, [{ id: 5 }]);

    await act(async () => container.querySelectorAll('button')[1]?.click());

    expect(queryClient.getQueryData(queryKeys.cart)).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.pets)).toBeUndefined();
    expect(tokenStorage.get()).toBeNull();
    expect(container.querySelector('output')?.textContent).toBe('guest');
  });

  it('clears private state before a slow logout request finishes', async () => {
    vi.mocked(api.verifyOtp).mockResolvedValue({
      accessToken: 'account-a-access',
      refreshToken: 'account-a-refresh',
      user: { ...profile, status: 'ACTIVE', isPhoneVerified: true },
      isNewUser: false,
    });
    let finishLogout!: (result: { ok: true }) => void;
    vi.mocked(api.logout).mockReturnValue(
      new Promise((resolve) => {
        finishLogout = resolve;
      }),
    );
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Probe />
          </AuthProvider>
        </QueryClientProvider>,
      );
    });
    await act(async () => container.querySelectorAll('button')[0]?.click());
    queryClient.setQueryData(queryKeys.cart, { items: [{ id: 9 }], itemsTotal: 100 });

    await act(async () => container.querySelectorAll('button')[1]?.click());

    expect(api.logout).toHaveBeenCalledWith('account-a-refresh');
    expect(tokenStorage.get()).toBeNull();
    expect(queryClient.getQueryData(queryKeys.cart)).toBeUndefined();
    expect(container.querySelector('output')?.textContent).toBe('guest');
    await act(async () => finishLogout({ ok: true }));
  });
});

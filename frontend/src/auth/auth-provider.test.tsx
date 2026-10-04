// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/query-keys';
import { tokenStorage } from '../lib/storage';
import { readPendingOrder, writePendingOrder } from '../features/checkout/pending-order';
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
    vi.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
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
    writePendingOrder({ orderId: 19, orderNumber: 'ACCOUNT-A-19' });
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
    expect(readPendingOrder()).toBeNull();
    expect(tokenStorage.get()).toBe('account-b-refresh');
    expect(container.querySelector('output')?.textContent).toBe('authed');
  });

  it('never leaves a verified session active when the profile cannot be loaded', async () => {
    vi.mocked(api.verifyOtp).mockResolvedValue({
      accessToken: 'temporary-access',
      refreshToken: 'temporary-refresh',
      user: { ...profile, status: 'ACTIVE', isPhoneVerified: true },
      isNewUser: false,
    });
    vi.mocked(api.me).mockRejectedValue(new Error('network unavailable'));
    let verify!: () => Promise<unknown>;
    function FailedProfileProbe() {
      const auth = useAuth();
      useEffect(() => {
        verify = () => auth.verifyOtp('09123456789', '12345');
      }, [auth]);
      return <output>{auth.status}</output>;
    }
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <FailedProfileProbe />
          </AuthProvider>
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await expect(verify()).rejects.toThrow('دریافت حساب ممکن نشد');
    });
    expect(tokenStorage.get()).toBeNull();
    expect(container.querySelector('output')?.textContent).toBe('guest');
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
    writePendingOrder({ orderId: 20, orderNumber: 'ACCOUNT-A-20' });

    await act(async () => container.querySelectorAll('button')[1]?.click());

    expect(api.logout).toHaveBeenCalledWith('account-a-refresh');
    expect(readPendingOrder()).toBeNull();
    expect(tokenStorage.get()).toBeNull();
    expect(queryClient.getQueryData(queryKeys.cart)).toBeUndefined();
    expect(container.querySelector('output')?.textContent).toBe('guest');
    await act(async () => finishLogout({ ok: true }));
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  }

  let currentAuth!: ReturnType<typeof useAuth>;
  function SessionProbe() {
    const auth = useAuth();
    useEffect(() => {
      currentAuth = auth;
    }, [auth]);
    return <output>{`${auth.status}:${auth.user?.id ?? ''}`}</output>;
  }

  async function mountSession() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SessionProbe />
          </AuthProvider>
        </QueryClientProvider>,
      );
    });
  }

  function loginResult(id: number) {
    return {
      accessToken: `access-${id}`,
      refreshToken: `refresh-${id}`,
      user: { ...profile, id, status: 'ACTIVE' as const, isPhoneVerified: true },
      isNewUser: false,
    };
  }

  it('does not restore a delayed bootstrap profile after logout', async () => {
    tokenStorage.set('old-refresh');
    vi.mocked(api.refresh).mockResolvedValue({
      accessToken: 'old-access',
      refreshToken: 'rotated',
    });
    vi.mocked(api.logout).mockResolvedValue({ ok: true });
    const pendingProfile = deferred<typeof profile>();
    vi.mocked(api.me).mockReturnValue(pendingProfile.promise);
    await mountSession();
    expect(api.me).toHaveBeenCalledTimes(1);
    await act(async () => currentAuth.logout());
    await act(async () => pendingProfile.resolve(profile));
    expect(container.querySelector('output')?.textContent).toBe('guest:');
    expect(tokenStorage.get()).toBeNull();
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores an older account profile %s after a newer OTP session completes',
    async (outcome) => {
      await mountSession();
      const oldProfile = deferred<typeof profile>();
      vi.mocked(api.verifyOtp)
        .mockResolvedValueOnce(loginResult(1))
        .mockResolvedValueOnce(loginResult(2));
      vi.mocked(api.me)
        .mockReturnValueOnce(oldProfile.promise)
        .mockResolvedValueOnce({ ...profile, id: 2 });
      let first!: Promise<unknown>;
      await act(async () => {
        first = currentAuth.verifyOtp('09123456789', '12345').catch((error: unknown) => error);
      });
      await act(async () => currentAuth.verifyOtp('09123456788', '12345'));
      expect(container.querySelector('output')?.textContent).toBe('authed:2');
      await act(async () => {
        if (outcome === 'resolve') oldProfile.resolve(profile);
        else oldProfile.reject(new Error('old profile failed'));
        await first;
      });
      expect(container.querySelector('output')?.textContent).toBe('authed:2');
      expect(tokenStorage.get()).toBe('refresh-2');
    },
  );

  it('ignores OTP verification that completes after logout', async () => {
    await mountSession();
    const pendingOtp = deferred<ReturnType<typeof loginResult>>();
    vi.mocked(api.verifyOtp).mockReturnValue(pendingOtp.promise);
    let login!: Promise<unknown>;
    await act(async () => {
      login = currentAuth.verifyOtp('09123456789', '12345').catch((error: unknown) => error);
    });
    await act(async () => currentAuth.logout());
    writePendingOrder({ orderId: 10, orderNumber: 'NEW-SESSION-10' });
    await act(async () => {
      pendingOtp.resolve(loginResult(1));
      await login;
    });
    expect(tokenStorage.get()).toBeNull();
    expect(readPendingOrder()?.orderNumber).toBe('NEW-SESSION-10');
    expect(api.me).not.toHaveBeenCalled();
    expect(container.querySelector('output')?.textContent).toBe('guest:');
  });

  it('does not store tokens from an OTP response after provider unmount', async () => {
    await mountSession();
    const pendingOtp = deferred<ReturnType<typeof loginResult>>();
    vi.mocked(api.verifyOtp).mockReturnValue(pendingOtp.promise);
    let login!: Promise<unknown>;
    await act(async () => {
      login = currentAuth.verifyOtp('09123456789', '12345').catch((error: unknown) => error);
    });
    await act(async () => root.render(null));
    await act(async () => {
      pendingOtp.resolve(loginResult(1));
      await login;
    });
    expect(tokenStorage.get()).toBeNull();
    expect(api.me).not.toHaveBeenCalled();
  });

  it('discards a delayed refresh after logout and never fetches the old profile', async () => {
    tokenStorage.set('old-refresh');
    const pendingRefresh = deferred<{ accessToken: string; refreshToken: string }>();
    vi.mocked(api.refresh).mockReturnValue(pendingRefresh.promise);
    vi.mocked(api.logout).mockResolvedValue({ ok: true });
    await mountSession();
    await act(async () => currentAuth.logout());
    await act(async () =>
      pendingRefresh.resolve({ accessToken: 'old-access', refreshToken: 'rotated' }),
    );
    expect(tokenStorage.get()).toBeNull();
    expect(api.me).not.toHaveBeenCalled();
    expect(container.querySelector('output')?.textContent).toBe('guest:');
  });

  it('does not apply a saved profile from a previous identity or after logout', async () => {
    await mountSession();
    vi.mocked(api.verifyOtp).mockResolvedValue(loginResult(2));
    vi.mocked(api.me).mockResolvedValue({ ...profile, id: 2 });
    vi.mocked(api.logout).mockResolvedValue({ ok: true });
    await act(async () => currentAuth.verifyOtp('09123456788', '12345'));
    await act(async () => currentAuth.applyProfile(profile));
    expect(currentAuth.user?.id).toBe(2);
    await act(async () => currentAuth.logout());
    await act(async () => currentAuth.applyProfile({ ...profile, id: 2 }));
    expect(container.querySelector('output')?.textContent).toBe('guest:');
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores an older bootstrap refresh %s after a new OTP session',
    async (outcome) => {
      tokenStorage.set('old-refresh');
      const oldRefresh = deferred<{ accessToken: string; refreshToken: string }>();
      vi.mocked(api.refresh).mockReturnValue(oldRefresh.promise);
      await mountSession();
      vi.mocked(api.verifyOtp).mockResolvedValue(loginResult(2));
      vi.mocked(api.me).mockResolvedValue({ ...profile, id: 2 });
      await act(async () => currentAuth.verifyOtp('09123456788', '12345'));
      await act(async () => {
        if (outcome === 'resolve')
          oldRefresh.resolve({ accessToken: 'old-access', refreshToken: 'old-rotated' });
        else oldRefresh.reject(new Error('old refresh failed'));
      });
      expect(container.querySelector('output')?.textContent).toBe('authed:2');
      expect(tokenStorage.get()).toBe('refresh-2');
      expect(api.me).toHaveBeenCalledTimes(1);
    },
  );
});

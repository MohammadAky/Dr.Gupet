// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { readOtpCooldown, readOtpPhone, storeOtpPhone } from '../auth/otp-flow';
import { LoginPage } from './LoginPage';

vi.mock('../api/endpoints', () => ({ api: { requestOtp: vi.fn() } }));
vi.mock('../auth/auth-provider', () => ({
  useAuth: () => ({ loginPassword: vi.fn(), registerPassword: vi.fn() }),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function VerificationDestination() {
  const location = useLocation();
  return <h2>کد تأیید {location.search}</h2>;
}

describe('customer initial OTP request safeguards', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  async function renderPage() {
    await act(async () => {
      root.render(
        <StrictMode>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/login?next=/profile']}>
              <Link to="/catalog">ترک صفحه</Link>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/verify" element={<VerificationDestination />} />
                <Route path="/catalog" element={<h2>کاتالوگ</h2>} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </StrictMode>,
      );
      await flush();
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'کد پیامکی')!
        .click();
    });
  }
  async function enterPhone(value = '۰۹۱۲۰۰۰۰۰۰۰') {
    await act(async () => {
      const input = container.querySelector('input')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  function submit() {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    window.sessionStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    window.sessionStorage.clear();
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends once for same-tick submits and locks the phone until the response arrives', async () => {
    const send = deferred<{ expiresIn: number; cooldownSeconds: number }>();
    vi.mocked(api.requestOtp).mockReturnValue(send.promise);
    await renderPage();
    await enterPhone();
    await act(async () => {
      submit();
      submit();
      await flush();
    });
    expect(api.requestOtp).toHaveBeenCalledExactlyOnceWith('09120000000');
    expect(container.querySelector('input')!.disabled).toBe(true);
    expect(container.querySelector('button')!.disabled).toBe(true);
    await act(async () => {
      send.resolve({ expiresIn: 120, cooldownSeconds: 5 });
      await flush();
    });
    expect(readOtpPhone()).toBe('09120000000');
    expect(readOtpCooldown('09120000000')).toBe(5);
    expect(container.querySelector('h2')!.textContent).toContain('?next=%2Fprofile');
  });

  it('does not overwrite a newer phone flow or navigate after leaving during delivery', async () => {
    const send = deferred<{ expiresIn: number; cooldownSeconds: number }>();
    vi.mocked(api.requestOtp).mockReturnValue(send.promise);
    await renderPage();
    await enterPhone();
    await act(async () => {
      submit();
      await flush();
    });
    await act(async () => {
      (container.querySelector('a') as HTMLAnchorElement).click();
      await flush();
    });
    storeOtpPhone('09121111111');
    await act(async () => {
      send.resolve({ expiresIn: 120, cooldownSeconds: 60 });
      await flush();
    });
    expect(readOtpPhone()).toBe('09121111111');
    expect(readOtpCooldown('09120000000')).toBe(0);
    expect(container.querySelector('h2')!.textContent).toBe('کاتالوگ');
  });

  it('unlocks after delivery failure and allows a corrected number to retry', async () => {
    vi.mocked(api.requestOtp)
      .mockRejectedValueOnce(new Error('ارسال انجام نشد'))
      .mockResolvedValueOnce({ expiresIn: 120, cooldownSeconds: 3 });
    await renderPage();
    await enterPhone();
    await act(async () => {
      submit();
      await flush();
    });
    expect(container.textContent).toContain('ارسال انجام نشد');
    expect(container.querySelector('input')!.disabled).toBe(false);
    expect(container.querySelector('button')!.disabled).toBe(false);
    expect(readOtpPhone()).toBeNull();
    await enterPhone('09121111111');
    await act(async () => {
      submit();
      await flush();
    });
    expect(api.requestOtp).toHaveBeenCalledTimes(2);
    expect(api.requestOtp).toHaveBeenLastCalledWith('09121111111');
    expect(readOtpPhone()).toBe('09121111111');
    expect(container.querySelector('h2')!.textContent).toContain('کد تأیید');
  });
});

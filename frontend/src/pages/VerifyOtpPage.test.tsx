// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { readOtpCooldown, storeOtpCooldown, storeOtpPhone } from '../auth/otp-flow';
import { VerifyOtpPage } from './VerifyOtpPage';

const auth = vi.hoisted(() => ({ verifyOtp: vi.fn() }));
vi.mock('../api/endpoints', () => ({ api: { requestOtp: vi.fn() } }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => auth }));

const phone = '09120000000';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

describe('customer OTP pending operations', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  function button(label: string): HTMLButtonElement {
    return [...container.querySelectorAll('button')].find((item) => item.textContent === label)!;
  }
  async function flush() { await new Promise((resolve) => setTimeout(resolve, 10)); }
  async function renderPage() {
    await act(async () => {
      root.render(<StrictMode><QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/verify?next=/profile']}>
          <Link to="/catalog">ترک صفحه</Link>
          <Routes>
            <Route path="/verify" element={<VerifyOtpPage />} />
            <Route path="/profile" element={<h2>حساب</h2>} />
            <Route path="/catalog" element={<h2>کاتالوگ</h2>} />
            <Route path="/login" element={<h2>شماره جدید</h2>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider></StrictMode>);
      await flush();
    });
  }
  async function enterCode() {
    await act(async () => {
      const input = container.querySelector('input')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '12345');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  function submit() { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    window.sessionStorage.clear();
    storeOtpPhone(phone);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.mocked(api.requestOtp).mockResolvedValue({ expiresIn: 120, cooldownSeconds: 1 });
    auth.verifyOtp.mockResolvedValue({ isNewUser: false });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    window.sessionStorage.clear();
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('locks verification and number changes during resend, including same-tick duplicate clicks', async () => {
    const resend = deferred<{ expiresIn: number; cooldownSeconds: number }>();
    vi.mocked(api.requestOtp).mockReturnValue(resend.promise);
    await renderPage();
    await enterCode();
    const resendButton = button('ارسال مجدد کد');
    await act(async () => {
      resendButton.click();
      resendButton.click();
      submit();
      button('تغییر شماره').click();
      await flush();
    });
    expect(api.requestOtp).toHaveBeenCalledExactlyOnceWith(phone);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(container.querySelector('input')!.disabled).toBe(true);
    expect(button('ورود').disabled).toBe(true);
    expect(button('تغییر شماره').disabled).toBe(true);
    await act(async () => { resend.resolve({ expiresIn: 120, cooldownSeconds: 1 }); await flush(); });
    expect(container.querySelector('input')!.value).toBe('');
    expect(container.querySelector('input')!.disabled).toBe(false);
    expect(readOtpCooldown(phone)).toBe(1);
    expect(container.textContent).toContain('ارسال مجدد کد (1 ثانیه)');
  });

  it('blocks resend and duplicate submits while verification is pending', async () => {
    const verify = deferred<{ isNewUser: boolean }>();
    auth.verifyOtp.mockReturnValue(verify.promise);
    await renderPage();
    await enterCode();
    await act(async () => {
      submit();
      submit();
      button('ارسال مجدد کد').click();
      button('تغییر شماره').click();
      await flush();
    });
    expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith(phone, '12345');
    expect(api.requestOtp).not.toHaveBeenCalled();
    expect(container.querySelector('input')!.disabled).toBe(true);
    expect(button('ارسال مجدد کد').disabled).toBe(true);
    await act(async () => { verify.reject(new Error('کد معتبر نیست')); await flush(); });
    expect(container.textContent).toContain('کد معتبر نیست');
    expect(button('ارسال مجدد کد').disabled).toBe(false);
    expect(button('ورود').disabled).toBe(false);
  });

  it('retains server cooldown and allows a failed resend to be retried', async () => {
    storeOtpCooldown(phone, 1);
    vi.mocked(api.requestOtp).mockRejectedValueOnce(new Error('پیامک ارسال نشد'));
    await renderPage();
    expect(button('ارسال مجدد کد (1 ثانیه)').disabled).toBe(true);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
    await act(async () => { button('ارسال مجدد کد').click(); await flush(); });
    expect(container.textContent).toContain('پیامک ارسال نشد');
    expect(button('ارسال مجدد کد').disabled).toBe(false);
    await act(async () => { button('ارسال مجدد کد').click(); await flush(); });
    expect(api.requestOtp).toHaveBeenCalledTimes(2);
    expect(readOtpCooldown(phone)).toBe(1);
    expect(container.textContent).not.toContain('پیامک ارسال نشد');
  });

  it('does not rewrite OTP storage from a resend completing after leaving the page', async () => {
    const resend = deferred<{ expiresIn: number; cooldownSeconds: number }>();
    vi.mocked(api.requestOtp).mockReturnValue(resend.promise);
    await renderPage();
    await act(async () => { button('ارسال مجدد کد').click(); await flush(); });
    await act(async () => { (container.querySelector('a') as HTMLAnchorElement).click(); await flush(); });
    expect(container.textContent).toContain('کاتالوگ');
    await act(async () => { resend.resolve({ expiresIn: 120, cooldownSeconds: 60 }); await flush(); });
    expect(readOtpCooldown(phone)).toBe(0);
    expect(container.textContent).toContain('کاتالوگ');
  });

  it('does not navigate or clear a later OTP flow when verification finishes after leaving', async () => {
    const verify = deferred<{ isNewUser: boolean }>();
    auth.verifyOtp.mockReturnValue(verify.promise);
    await renderPage();
    await enterCode();
    await act(async () => { submit(); await flush(); });
    await act(async () => { (container.querySelector('a') as HTMLAnchorElement).click(); await flush(); });
    storeOtpPhone('09121111111');
    await act(async () => { verify.resolve({ isNewUser: false }); await flush(); });
    expect(container.textContent).toContain('کاتالوگ');
    expect(container.textContent).not.toContain('حساب');
    expect(window.sessionStorage.getItem('drgupet.otpPhone')).toBe('09121111111');
  });
});

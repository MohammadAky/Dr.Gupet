// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { LoginPage } from './LoginPage';

const { loginPassword, registerPassword } = vi.hoisted(() => ({
  loginPassword: vi.fn(),
  registerPassword: vi.fn(),
}));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ loginPassword, registerPassword }) }));
vi.mock('../api/endpoints', () => ({
  api: { requestRegistrationOtp: vi.fn(), requestPasswordReset: vi.fn(), resetPassword: vi.fn() },
}));
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
async function mount() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/login?next=/orders']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/orders" element={<h2>سفارش‌ها</h2>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}
async function fill(id: string, value: string) {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(text: string) {
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === text)!
      .click();
  });
}
function submit() {
  container
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient();
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('defaults to password login, normalizes the username and blocks duplicate submits without changing the password', async () => {
  let finish!: () => void;
  loginPassword.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await mount();
  await fill('username', '  Kian.Test ');
  await fill('password', ' raw password  ');
  await act(async () => {
    submit();
    submit();
  });
  expect(loginPassword).toHaveBeenCalledExactlyOnceWith({
    username: 'kian.test',
    password: ' raw password  ',
  });
  expect(container.querySelector<HTMLInputElement>('#password')!.disabled).toBe(true);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  await act(async () => finish());
  expect(container.textContent).toContain('سفارش‌ها');
});

it('requires matching passwords and verified phone OTP before registration; stores no credentials in browser storage', async () => {
  vi.mocked(api.requestRegistrationOtp).mockResolvedValue({ expiresIn: 300, cooldownSeconds: 7 });
  registerPassword.mockResolvedValue({ isNewUser: true });
  await mount();
  await click('حساب ندارید؟ ثبت‌نام');
  await fill('username', 'New.User');
  await fill('password-phone', '۰۹۱۲۰۰۰۰۰۰۰');
  await fill('password', 'a long password');
  await fill('password-confirm', 'wrong');
  await act(async () => submit());
  expect(api.requestRegistrationOtp).not.toHaveBeenCalled();
  expect(container.textContent).toContain('تکرار رمز عبور یکسان نیست');
  await fill('password-confirm', 'a long password');
  await act(async () => {
    submit();
    submit();
  });
  expect(api.requestRegistrationOtp).toHaveBeenCalledExactlyOnceWith('09120000000');
  expect(registerPassword).not.toHaveBeenCalled();
  expect(container.textContent).toContain('ارسال مجدد کد (7 ثانیه)');
  await fill('password-otp', '۱۲۳۴۵۶');
  await act(async () => submit());
  expect(registerPassword).toHaveBeenCalledExactlyOnceWith({
    username: 'new.user',
    password: 'a long password',
    phone: '09120000000',
    code: '123456',
    firstName: undefined,
    lastName: undefined,
  });
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it('uses generic recovery feedback, respects cooldown and returns to password login after reset', async () => {
  vi.mocked(api.requestPasswordReset).mockResolvedValue({ expiresIn: 300, cooldownSeconds: 4 });
  vi.mocked(api.resetPassword).mockResolvedValue({ ok: true });
  await mount();
  await click('رمز عبور را فراموش کرده‌اید؟');
  await fill('username', 'Kian');
  await fill('password-phone', '09120000000');
  await act(async () => submit());
  expect(api.requestPasswordReset).toHaveBeenCalledExactlyOnceWith({
    username: 'kian',
    phone: '09120000000',
  });
  expect(container.textContent).toContain('اگر اطلاعات با حساب مطابقت داشته باشد');
  const resend = Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.startsWith('ارسال مجدد کد'),
  )!;
  expect(resend.disabled).toBe(true);
  await act(async () => resend.click());
  expect(api.requestPasswordReset).toHaveBeenCalledTimes(1);
  await fill('password', 'a new password');
  await fill('password-confirm', 'a new password');
  await fill('password-otp', '123456');
  await act(async () => submit());
  expect(api.resetPassword).toHaveBeenCalledExactlyOnceWith({
    username: 'kian',
    phone: '09120000000',
    code: '123456',
    newPassword: 'a new password',
  });
  expect(container.querySelector<HTMLInputElement>('#password')!.value).toBe('');
  expect(container.textContent).toContain('ورود به حساب');
  expect(loginPassword).not.toHaveBeenCalled();
});

it('continues the recovery cooldown while editing details and unlocks when the server duration expires', async () => {
  vi.useFakeTimers();
  vi.mocked(api.requestPasswordReset).mockResolvedValue({ expiresIn: 300, cooldownSeconds: 3 });
  await mount();
  await click('رمز عبور را فراموش کرده‌اید؟');
  await fill('username', 'kian');
  await fill('password-phone', '09120000000');
  await act(async () => submit());
  await click('ویرایش اطلاعات');
  const button = () =>
    Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === 'دریافت کد بازیابی',
    )!;
  expect(button().disabled).toBe(true);
  expect(container.textContent).toContain('درخواست کد جدید تا 3 ثانیه دیگر');
  await act(async () => {
    vi.advanceTimersByTime(3000);
  });
  expect(button().disabled).toBe(false);
});

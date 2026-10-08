// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PasswordChange } from './PasswordChange';
const { auth } = vi.hoisted(() => ({
  auth: { user: { username: 'kian' as string | null }, changePassword: vi.fn(), logout: vi.fn() },
}));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => auth }));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  auth.user.username = 'kian';
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <PasswordChange />
      </MemoryRouter>,
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
function submit() {
  container
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
it('requires the current password and matching confirmation, sends once, and clears credentials after rotation', async () => {
  let finish!: () => void;
  auth.changePassword.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await mount();
  await fill('current-password', ' current password ');
  await fill('new-password', ' new password ');
  await fill('confirm-new-password', 'mismatch');
  await act(async () => submit());
  expect(auth.changePassword).not.toHaveBeenCalled();
  await fill('confirm-new-password', ' new password ');
  await act(async () => {
    submit();
    submit();
  });
  expect(auth.changePassword).toHaveBeenCalledExactlyOnceWith(
    ' current password ',
    ' new password ',
  );
  await act(async () => finish());
  expect(container.querySelector<HTMLInputElement>('#current-password')!.value).toBe('');
  expect(container.querySelector<HTMLInputElement>('#new-password')!.value).toBe('');
  expect(container.textContent).toContain('رمز عبور تغییر کرد');
});
it('offers the same-phone registration flow to an OTP-only account and explicitly exits the current session', async () => {
  auth.user.username = null;
  await mount();
  const link = container.querySelector('a')!;
  expect(link.getAttribute('href')).toBe('/login?mode=register&next=%2Fprofile');
  expect(container.textContent).toContain('همین شمارهٔ موبایل');
  await act(async () => link.click());
  expect(auth.logout).toHaveBeenCalledOnce();
});

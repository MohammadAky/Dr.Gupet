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
    input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
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
  for (const id of ['current-password', 'new-password', 'confirm-new-password']) {
    expect(container.querySelector<HTMLInputElement>(`#${id}`)?.required).toBe(true);
  }
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
it('focuses the first invalid field and clears corrected field errors before resubmission', async () => {
  await mount(); await act(async () => submit());
  await vi.waitFor(() => expect(document.activeElement?.id).toBe('current-password'));
  expect(container.querySelector('#current-password')?.getAttribute('aria-invalid')).toBe('true');
  await fill('current-password', 'present password');
  expect(container.querySelector('#current-password')?.getAttribute('aria-invalid')).not.toBe('true');
  await fill('new-password', 'new long password'); await fill('confirm-new-password', 'new long password');
  expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  expect(auth.changePassword).not.toHaveBeenCalled();
});
it('starts current password empty and locked until deliberate pointer or keyboard input', async () => {
  await mount();
  const current = container.querySelector<HTMLInputElement>('#current-password')!;
  expect(current.value).toBe('');
  expect(current.autocomplete).toBe('off');
  expect(current.readOnly).toBe(true);
  await act(async () => current.focus());
  expect(current.readOnly).toBe(true);
  await act(async () => current.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })));
  expect(current.readOnly).toBe(false);
});
it('updates accessible password strength and checks while preserving lowercase password acceptance', async () => {
  await mount();
  const meter = () => container.querySelector('[role="meter"]')!;
  expect(meter().getAttribute('aria-valuenow')).toBe('0');
  await fill('new-password', 'A2');
  expect(meter().getAttribute('aria-valuetext')).toBe('ضعیف');
  expect(container.querySelectorAll('.password-strength [data-met="true"]')).toHaveLength(2);
  await fill('new-password', 'Abcdefg2');
  expect(meter().getAttribute('aria-valuetext')).toBe('خوب');
  await fill('new-password', 'Abcdefghijkl2');
  expect(meter().getAttribute('aria-valuetext')).toBe('عالی');
  await fill('new-password', 'lowercase password');
  expect(meter().getAttribute('aria-valuetext')).toBe('متوسط');
  expect(container.textContent).not.toContain('بایت');
  await fill('current-password', 'previous password');
  await fill('confirm-new-password', 'lowercase password');
  await act(async () => submit());
  expect(auth.changePassword).toHaveBeenCalledExactlyOnceWith('previous password', 'lowercase password');
});

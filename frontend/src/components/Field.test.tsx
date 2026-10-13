// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { PasswordInput } from './PasswordInput';

describe('form labels and accessible feedback', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('connects generated labels to distinct controls and replaces hints with an announced error', async () => {
    function fields(error?: string) {
      return (
        <>
          <p id="external-help">نامی که در حساب نمایش داده می‌شود.</p>
          <Field label="نام" hint="نام خود را وارد کنید." error={error}>
            <input aria-describedby="external-help" />
          </Field>
          <Field label="شهر">
            <input />
          </Field>
        </>
      );
    }
    await act(async () => root.render(fields()));
    const labels = Array.from(container.querySelectorAll<HTMLLabelElement>('label'));
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input'));
    expect(labels[0]?.control).toBe(inputs[0]);
    expect(labels[1]?.control).toBe(inputs[1]);
    expect(inputs[0]?.id).toBeTruthy();
    expect(inputs[0]?.id).not.toBe(inputs[1]?.id);
    const input = inputs[0]!;
    const id = input.id;
    const hint = container.querySelector('.field__hint')!;
    expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual(['external-help', hint.id]);
    expect(input.getAttribute('aria-invalid')).not.toBe('true');

    await act(async () => root.render(fields('نام نمی‌تواند خالی باشد.')));
    const error = container.querySelector('[role="alert"]')!;
    expect(container.querySelector('input')).toBe(input);
    expect(input.id).toBe(id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual(['external-help', error.id]);
    expect(document.getElementById(error.id)?.textContent).toBe('نام نمی‌تواند خالی باشد.');
    expect(container.querySelector('.field__hint')).toBeNull();
  });

  it('adopts an existing control identity without breaking its label or help relationship', async () => {
    await act(async () =>
      root.render(
        <Field label="نشانی" hint="نشانی کامل گیرنده را بنویسید.">
          <textarea id="delivery-address" defaultValue="مشهد" />
        </Field>,
      ),
    );
    const label = container.querySelector<HTMLLabelElement>('label')!;
    const control = container.querySelector('textarea')!;
    expect(label.htmlFor).toBe('delivery-address');
    expect(label.control).toBe(control);
    expect(control.getAttribute('aria-describedby')).toBe(
      container.querySelector('.field__hint')?.id,
    );
  });

  it('passes field errors and existing help to the native password control while visibility changes', async () => {
    await act(async () =>
      root.render(
        <>
          <p id="password-policy">رمز حساب خود را وارد کنید.</p>
          <Field label="رمز عبور" error="رمز عبور را بررسی کنید.">
            <PasswordInput
              id="signin-password"
              value="private-test-password"
              onChange={() => {}}
              aria-describedby="password-policy"
            />
          </Field>
        </>,
      ),
    );
    const input = container.querySelector('input')!;
    const label = container.querySelector<HTMLLabelElement>('label')!;
    const error = container.querySelector('[role="alert"]')!;
    const toggle = container.querySelector('button')!;
    expect(label.control).toBe(input);
    expect(input.type).toBe('password');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'password-policy',
      error.id,
    ]);
    expect(toggle.getAttribute('aria-controls')).toBe(input.id);
    expect(toggle.getAttribute('aria-label')).toBe('نمایش رمز');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    await act(async () => toggle.click());
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('پنهان کردن رمز');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'password-policy',
      error.id,
    ]);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});

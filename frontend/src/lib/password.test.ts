import { expect, it } from 'vitest';
import { passwordError, usernameError } from './password';
it('validates Unicode character count and the UTF-8 byte limit without trimming a password', () => {
  expect(passwordError('a'.repeat(7))).toBeTruthy();
  expect(passwordError('a'.repeat(8))).toBeUndefined();
  expect(passwordError('🔐'.repeat(8))).toBeUndefined();
  expect(passwordError('a'.repeat(72))).toBeUndefined();
  expect(passwordError('a'.repeat(73))).toBeTruthy();
  expect(passwordError('پ'.repeat(36))).toBeUndefined();
  expect(passwordError('پ'.repeat(37))).toBeTruthy();
  expect(passwordError('🔐'.repeat(7))).toBeTruthy();
  expect(usernameError(' A.User_1 ')).toBeUndefined();
  expect(usernameError('کاربر')).toBeTruthy();
});

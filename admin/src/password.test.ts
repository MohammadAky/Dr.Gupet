import { expect, it } from 'vitest';
import { credentialError, credentialFieldErrors } from './password';
it('accepts exactly eight Unicode characters for administrator creation/assignment and rejects seven', () => {
  expect(credentialError('admin.user', '1234567')).toContain('۸');
  expect(credentialError('admin.user', '12345678')).toBe('');
  expect(credentialError('admin.user', '🔐'.repeat(8))).toBe('');
  expect(credentialFieldErrors('admin.user', '12345678', '12345678', 'create')).toEqual({});
  expect(credentialFieldErrors('admin.user', '1234567', '1234567', 'assign')['assign-password']).toContain('۸');
});
it('retains the bcrypt 72 UTF-8 byte bound and matching-confirmation check', () => {
  expect(credentialError('admin.user', 'پ'.repeat(36))).toBe('');
  expect(credentialError('admin.user', 'پ'.repeat(37))).toContain('۷۲');
  expect(credentialError('admin.user', '12345678', '12345679')).toContain('یکسان');
});

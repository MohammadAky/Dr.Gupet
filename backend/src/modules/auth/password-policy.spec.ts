import * as bcrypt from 'bcrypt';
import { assertPassword, PASSWORD_BCRYPT_COST, validPassword } from './password-policy';

describe('Real password hashing policy', () => {
  it('uses bcrypt cost 12 and preserves the raw password rather than trimming it', async () => {
    const password = '  Exact-password-🙂  ';
    const hash = await bcrypt.hash(password, PASSWORD_BCRYPT_COST);
    expect(hash).not.toContain(password);
    expect(bcrypt.getRounds(hash)).toBe(12);
    await expect(bcrypt.compare(password, hash)).resolves.toBe(true);
    await expect(bcrypt.compare(password.trim(), hash)).resolves.toBe(false);
    expect(validPassword('ژ'.repeat(36))).toBe(true);
    expect(validPassword('ژ'.repeat(37))).toBe(false);
  });
});

describe('Eight-character password boundaries', () => {
  it.each(['safe1234', 'ژ'.repeat(8), '🙂'.repeat(8)])(
    'accepts exactly eight Unicode characters without changing the raw value',
    (password) => {
      expect(validPassword(password)).toBe(true);
      expect(() => assertPassword(password)).not.toThrow();
    },
  );

  it.each(['safe123', 'ژ'.repeat(7), '🙂'.repeat(7)])(
    'rejects seven Unicode characters including surrogate pairs',
    (password) => {
      expect(validPassword(password)).toBe(false);
      expect(() => assertPassword(password)).toThrow('حداقل ۸ کاراکتر');
    },
  );

  it('retains the byte limit and NUL guard for new short passwords', () => {
    expect(validPassword('🙂'.repeat(18))).toBe(true);
    expect(validPassword('🙂'.repeat(19))).toBe(false);
    expect(validPassword('safe123\0')).toBe(false);
  });

  it('hashes and verifies an exact eight-character password at the existing cost', async () => {
    const password = 'ژ🙂safe12';
    expect([...password]).toHaveLength(8);
    const hash = await bcrypt.hash(password, PASSWORD_BCRYPT_COST);
    expect(bcrypt.getRounds(hash)).toBe(12);
    await expect(bcrypt.compare(password, hash)).resolves.toBe(true);
    await expect(bcrypt.compare('ژ🙂safe13', hash)).resolves.toBe(false);
  });
});

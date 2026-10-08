import * as bcrypt from 'bcrypt';
import { PASSWORD_BCRYPT_COST, validPassword } from './password-policy';

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

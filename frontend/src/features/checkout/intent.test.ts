import { afterEach, describe, expect, it } from 'vitest';
import { clearCheckoutIntent, readCheckoutIntent, writeCheckoutIntent } from './intent';

afterEach(clearCheckoutIntent);

describe('session checkout intent', () => {
  it('keeps text and address selection through same-user route changes without keeping amounts', () => {
    writeCheckoutIntent(1, { couponCode: 'SAVE', note: 'تحویل عصر' });
    writeCheckoutIntent(1, { addressId: 8 });
    expect(readCheckoutIntent(1)).toEqual({ couponCode: 'SAVE', note: 'تحویل عصر', addressId: 8 });
    const copy = readCheckoutIntent(1);
    copy.couponCode = 'OTHER';
    expect(readCheckoutIntent(1).couponCode).toBe('SAVE');
  });

  it('isolates identities and clears every field when a session ends', () => {
    writeCheckoutIntent(1, { couponCode: 'PRIVATE', note: 'نشانی شخصی', addressId: 3 });
    expect(readCheckoutIntent(2)).toEqual({ couponCode: '', note: '', addressId: null });
    writeCheckoutIntent(2, { couponCode: 'NEW' });
    expect(readCheckoutIntent(1).couponCode).toBe('');
    clearCheckoutIntent();
    expect(readCheckoutIntent(2).couponCode).toBe('');
  });

  it('bounds notes and rejects invalid identities and address IDs without altering coupon text', () => {
    writeCheckoutIntent(-1, { couponCode: 'INVALID' });
    expect(readCheckoutIntent(-1).couponCode).toBe('');
    writeCheckoutIntent(1, { couponCode: 'a'.repeat(200), note: 'b'.repeat(700), addressId: NaN });
    expect(readCheckoutIntent(1)).toEqual({
      couponCode: 'a'.repeat(200),
      note: 'b'.repeat(500),
      addressId: null,
    });
  });
});

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { GuestTransferDto } from './dto/guest-transfer.dto';

/** Issue #17 — Prisma quantity is Int; fractional/unsafe values must never pass. */
const addErrors = (payload: Record<string, unknown>) =>
  validateSync(plainToInstance(AddCartItemDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).length;
const updateErrors = (payload: Record<string, unknown>) =>
  validateSync(plainToInstance(UpdateCartItemDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).length;

describe('Cart quantity contract (issue #17)', () => {
  it.each([1, 2, 20])('accepts integer quantity %s', (quantity) => {
    expect(addErrors({ variantId: 4, quantity })).toBe(0);
    expect(updateErrors({ quantity })).toBe(0);
  });

  it.each([0, -1, 1.5, 21, 1e9])('rejects quantity %s', (quantity) => {
    expect(addErrors({ variantId: 4, quantity })).toBeGreaterThan(0);
    expect(updateErrors({ quantity })).toBeGreaterThan(0);
  });

  it.each([0, -3, 1.2, '4', null])('rejects invalid variantId %s', (variantId) => {
    expect(addErrors({ variantId, quantity: 1 })).toBeGreaterThan(0);
  });

  it('rejects unknown fields instead of silently accepting them', () => {
    expect(addErrors({ variantId: 4, quantity: 1, price: 0 })).toBeGreaterThan(0);
  });
});

/** Issue #38 — the guest handoff accepts quantities only, never prices. */
const transferErrors = (payload: Record<string, unknown>) =>
  validateSync(plainToInstance(GuestTransferDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).length;
const REQUEST_ID = 'req-0123456789abcdef';

describe('Guest transfer contract (issue #38)', () => {
  it('accepts a request id plus bounded rows', () => {
    expect(
      transferErrors({
        requestId: REQUEST_ID,
        rows: [
          { variantId: 1, quantity: 2 },
          { variantId: 2, quantity: 5 },
        ],
        overlapPolicy: 'replace',
        expectedCartVersion: '2026-10-20T10:00:00.000Z',
      }),
    ).toBe(0);
  });

  it.each([
    ['short request id', { requestId: 'abc', rows: [{ variantId: 1, quantity: 1 }] }],
    ['request id with spaces', { requestId: 'req 0123456789abcd', rows: [{ variantId: 1, quantity: 1 }] }],
    ['empty rows', { requestId: REQUEST_ID, rows: [] }],
    ['too many rows', { requestId: REQUEST_ID, rows: Array.from({ length: 51 }, (_, i) => ({ variantId: i + 1, quantity: 1 })) }],
    ['zero quantity', { requestId: REQUEST_ID, rows: [{ variantId: 1, quantity: 0 }] }],
    ['fractional quantity', { requestId: REQUEST_ID, rows: [{ variantId: 1, quantity: 1.5 }] }],
    ['quantity above the cart cap', { requestId: REQUEST_ID, rows: [{ variantId: 1, quantity: 21 }] }],
    ['string variant id', { requestId: REQUEST_ID, rows: [{ variantId: '1', quantity: 1 }] }],
    ['client price field', { requestId: REQUEST_ID, rows: [{ variantId: 1, quantity: 1, price: 0 }] }],
    ['summed total field', { requestId: REQUEST_ID, rows: [{ variantId: 1, quantity: 1 }], itemsTotal: 0 }],
    ['unknown overlap policy', { requestId: REQUEST_ID, rows: [{ variantId: 1, quantity: 1 }], overlapPolicy: 'merge' }],
    ['non-ISO cart version', { requestId: REQUEST_ID, rows: [{ variantId: 1, quantity: 1 }], expectedCartVersion: 'v1' }],
  ])('rejects %s', (_label, payload) => {
    expect(transferErrors(payload as Record<string, unknown>)).toBeGreaterThan(0);
  });
});

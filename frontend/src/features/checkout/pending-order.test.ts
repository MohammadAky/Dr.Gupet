// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPendingOrder, readPendingOrder, writePendingOrder } from './pending-order';

afterEach(() => { vi.restoreAllMocks(); window.sessionStorage.clear(); });

describe('pending order lookup hint', () => {
  it('round trips a positive safe integer ID and can clear the marker', () => {
    writePendingOrder({ orderId: 8, orderNumber: 'O-8' });
    expect(readPendingOrder()).toEqual({ orderId: 8, orderNumber: 'O-8' });
    clearPendingOrder();
    expect(readPendingOrder()).toBeNull();
  });

  it('rejects malformed data and fractional, negative, zero, or unsafe IDs', () => {
    for (const value of [null, [], {}, 'text', { orderId: '8', orderNumber: 'O-8' },
      ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map((orderId) => ({ orderId, orderNumber: 'O-8' })),
      { orderId: 8, orderNumber: '' }, { orderId: 8, orderNumber: '  ' }]) {
      window.sessionStorage.setItem('drgupet.pendingOrder', JSON.stringify(value));
      expect(readPendingOrder()).toBeNull();
    }
    window.sessionStorage.setItem('drgupet.pendingOrder', '{bad json');
    expect(readPendingOrder()).toBeNull();
  });

  it('does not replace a valid marker with invalid runtime input', () => {
    writePendingOrder({ orderId: 8, orderNumber: 'O-8' });
    for (const orderId of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      writePendingOrder({ orderId, orderNumber: 'O-8' });
      expect(readPendingOrder()).toEqual({ orderId: 8, orderNumber: 'O-8' });
    }
  });

  it('tolerates unavailable session storage without breaking payment recovery', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => writePendingOrder({ orderId: 8, orderNumber: 'O-8' })).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readPendingOrder()).toBeNull();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(clearPendingOrder).not.toThrow();
  });
});

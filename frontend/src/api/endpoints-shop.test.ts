import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request, requestData } from './client';
import { shopApi } from './endpoints-shop';

vi.mock('./client', () => ({ requestData: vi.fn(), request: vi.fn() }));

const address = {
  title: 'خانه',
  receiverName: 'کاربر آزمایش',
  receiverPhone: '09999999999',
  province: 'خراسان رضوی',
  city: 'مشهد',
  fullAddress: 'نشانی آزمایش',
  postalCode: null,
};

describe('order address snapshots', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the MySQL JSON text without losing other order data', async () => {
    vi.mocked(requestData).mockResolvedValue({
      id: 7,
      status: 'PROCESSING',
      addressSnapshot: JSON.stringify(address),
    });
    expect(await shopApi.order(7)).toEqual({
      id: 7,
      status: 'PROCESSING',
      addressSnapshot: address,
    });
    expect(requestData).toHaveBeenCalledWith('/orders/7');
  });

  it('keeps a valid object and discards unexpected fields', async () => {
    vi.mocked(requestData).mockResolvedValue({
      id: 7,
      addressSnapshot: { ...address, postalCode: '1234567890', unexpected: true },
    });
    expect((await shopApi.order(7)).addressSnapshot).toEqual({
      ...address,
      postalCode: '1234567890',
    });
  });

  it.each([
    '{bad JSON',
    'null',
    '[]',
    '{}',
    { ...address, city: 4 },
    { ...address, receiverName: '' },
    { ...address, postalCode: {} },
    undefined,
  ])(
    'keeps malformed snapshots unavailable rather than crashing or inventing an address (%j)',
    async (addressSnapshot) => {
      vi.mocked(requestData).mockResolvedValue({ id: 7, addressSnapshot });
      expect(await shopApi.order(7)).toEqual({ id: 7, addressSnapshot: null });
    },
  );

  it('normalizes the creation and cancellation responses too', async () => {
    vi.mocked(requestData).mockResolvedValue({ id: 7, addressSnapshot: JSON.stringify(address) });
    expect((await shopApi.createOrder({ addressId: 2 })).addressSnapshot).toEqual(address);
    expect((await shopApi.cancelOrder(7)).addressSnapshot).toEqual(address);
    expect(requestData).toHaveBeenNthCalledWith(1, '/orders', {
      method: 'POST',
      body: { addressId: 2 },
    });
    expect(requestData).toHaveBeenNthCalledWith(2, '/orders/7/cancel', { method: 'POST' });
  });
});

describe('presentation filters and consent-based nearby requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(request).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 4, total: 0, totalPages: 0 },
    });
  });
  it.each([
    ['nearbyClinics', '/clinics/nearby'],
    ['nearbyPharmacies', '/pharmacies/nearby'],
  ] as const)(
    'sends %s coordinates in the body without URL query or account credentials',
    async (method, path) => {
      const body = { lat: 35.7, lng: 51.4, page: 1, limit: 4 };
      expect((await shopApi[method](body)).data).toEqual([]);
      expect(request).toHaveBeenCalledWith(path, { method: 'POST', body, auth: false });
    },
  );
  it('serializes the explicit sample-only product filter without changing ordinary catalog defaults', async () => {
    await shopApi.products({ sampleOnly: true });
    expect(request).toHaveBeenLastCalledWith('/products', {
      query: expect.objectContaining({ sampleOnly: 'true' }),
    });
    await shopApi.products({});
    expect(request).toHaveBeenLastCalledWith('/products', {
      query: expect.objectContaining({ sampleOnly: undefined }),
    });
  });
});

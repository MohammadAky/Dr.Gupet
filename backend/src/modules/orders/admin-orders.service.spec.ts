import { AdminOrdersService } from './admin-orders.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { OrderStockService } from './order-stock.service';

function makeService(status = 'PAID') {
  const order = {
    id: 1,
    orderNumber: 'DG-1',
    status,
    couponId: null as number | null,
    note: null as string | null,
    refundedAt: null as Date | null,
    refundNote: null as string | null,
    shippedAt: null as Date | null,
    deliveredAt: null as Date | null,
    trackingCode: null as string | null,
    shippingMethod: null as string | null,
    items: [{ variantId: 10, quantity: 2 }],
    payments: [] as Array<{ status: string }>,
  };
  const read = () => ({ ...order, items: [...order.items], payments: [...order.payments] });
  type Write = {
    where: { id: number; status?: string; refundedAt?: null };
    data: Partial<typeof order>;
  };
  const tx = {
    order: {
      findUnique: jest.fn(async () => read()),
      findUniqueOrThrow: jest.fn(async () => read()),
      updateMany: jest.fn(async ({ where, data }: Write) => {
        if (
          (where.status !== undefined && where.status !== order.status) ||
          (where.refundedAt === null && order.refundedAt !== null)
        )
          return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }: { data: Partial<typeof order> }) => {
        Object.assign(order, data);
        return read();
      }),
    },
    couponRedemption: { deleteMany: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const stock = { reserve: jest.fn(), release: jest.fn(async () => undefined) };
  const service = new AdminOrdersService(
    prisma as unknown as PrismaService,
    stock as unknown as OrderStockService,
  );
  return { service, order, prisma, stock };
}

describe('Admin order direct forward fulfillment (controlled conditional claims)', () => {
  it.each([
    ['PAID', 'PROCESSING'],
    ['PAID', 'SHIPPED'],
    ['PAID', 'DELIVERED'],
    ['PROCESSING', 'SHIPPED'],
    ['PROCESSING', 'DELIVERED'],
    ['SHIPPED', 'DELIVERED'],
  ])('accepts %s → %s in one atomic claim without moving stock', async (from, to) => {
    const h = makeService(from);
    await expect(h.service.transition(1, { to, expectedStatus: from })).resolves.toMatchObject({
      status: to,
    });
    expect(h.prisma.order.updateMany).toHaveBeenCalledTimes(1);
    expect(h.prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: from, refundedAt: null },
      data: expect.objectContaining({ status: to }),
    });
    expect(h.prisma.order.update).not.toHaveBeenCalled();
    expect(h.stock.reserve).not.toHaveBeenCalled();
    expect(h.stock.release).not.toHaveBeenCalled();
  });
  it.each([
    ['PENDING_PAYMENT', 'PROCESSING'],
    ['PENDING_PAYMENT', 'SHIPPED'],
    ['PENDING_PAYMENT', 'DELIVERED'],
    ['PAID', 'PAID'],
    ['PAID', 'PENDING_PAYMENT'],
    ['PAID', 'CANCELED'],
    ['PROCESSING', 'PAID'],
    ['PROCESSING', 'PROCESSING'],
    ['SHIPPED', 'PROCESSING'],
    ['DELIVERED', 'SHIPPED'],
    ['CANCELED', 'DELIVERED'],
    ['UNKNOWN', 'PROCESSING'],
    ['PAID', 'UNKNOWN'],
  ])(
    'rejects protected, backward, repeated or terminal %s → %s before claiming',
    async (from, to) => {
      const h = makeService(from);
      await expect(h.service.transition(1, { to })).rejects.toMatchObject({
        code: 'ORDER_INVALID_STATE',
      });
      expect(h.prisma.order.updateMany).not.toHaveBeenCalled();
      expect(h.order.status).toBe(from);
    },
  );
  it('records only delivery when processing and shipping were skipped', async () => {
    const h = makeService();
    await h.service.transition(1, {
      to: 'DELIVERED',
      note: 'unused',
      trackingCode: 'unused',
      shippingMethod: 'unused',
    });
    expect(h.order.deliveredAt).toBeInstanceOf(Date);
    expect(h.order.shippedAt).toBeNull();
    expect(h.order.note).toBeNull();
    expect(h.order.trackingCode).toBeNull();
    expect(h.prisma.order.updateMany.mock.calls[0][0].data).not.toHaveProperty('shippedAt');
  });
  it('records shipping fields for direct shipping and a processing note only for PROCESSING', async () => {
    const h = makeService();
    await h.service.transition(1, { to: 'SHIPPED', trackingCode: 'IR1', shippingMethod: 'post' });
    expect(h.order).toMatchObject({
      shippedAt: expect.any(Date),
      trackingCode: 'IR1',
      shippingMethod: 'post',
      deliveredAt: null,
    });
    const processing = makeService();
    await processing.service.transition(1, { to: 'PROCESSING', note: 'بسته‌بندی' });
    expect(processing.order.note).toBe('بسته‌بندی');
  });
  it.each(['PAID', 'PROCESSING', 'SHIPPED'])(
    'blocks fulfillment of refunded %s orders',
    async (from) => {
      const h = makeService(from);
      h.order.refundedAt = new Date();
      await expect(h.service.transition(1, { to: 'DELIVERED' })).rejects.toMatchObject({
        code: 'ORDER_INVALID_STATE',
      });
      expect(h.prisma.order.updateMany).not.toHaveBeenCalled();
    },
  );
  it('rejects stale/invalid expectations and preserves optional-client compatibility', async () => {
    const h = makeService('PROCESSING');
    await expect(
      h.service.transition(1, { to: 'DELIVERED', expectedStatus: 'PAID' }),
    ).rejects.toMatchObject({ code: 'ORDER_STALE_STATE' });
    await expect(
      h.service.transition(1, { to: 'DELIVERED', expectedStatus: 'unknown' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(h.prisma.order.updateMany).not.toHaveBeenCalled();
    await expect(h.service.transition(1, { to: 'DELIVERED' })).resolves.toMatchObject({
      status: 'DELIVERED',
    });
  });
  it('rejects a refund recorded between the eligibility read and claim', async () => {
    const h = makeService();
    h.prisma.order.updateMany.mockImplementationOnce(async () => {
      h.order.refundedAt = new Date();
      return { count: 0 };
    });
    await expect(h.service.transition(1, { to: 'SHIPPED' })).rejects.toMatchObject({
      code: 'ORDER_STALE_STATE',
    });
    expect(h.order.status).toBe('PAID');
    expect(h.order.shippedAt).toBeNull();
  });
  it('allows only one stale forward submission without regressing delivery', async () => {
    const h = makeService();
    const results = await Promise.allSettled([
      h.service.transition(1, { to: 'DELIVERED', expectedStatus: 'PAID' }),
      h.service.transition(1, { to: 'PROCESSING', expectedStatus: 'PAID' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'ORDER_STALE_STATE' },
    });
    expect(h.order.status).toBe('DELIVERED');
    expect(h.order.shippedAt).toBeNull();
  });
});

describe('Administrator cancellation claims before stock release', () => {
  it('claims once, appends the reason, then releases stock and coupon', async () => {
    const h = makeService('PENDING_PAYMENT');
    h.order.couponId = 5;
    h.order.note = 'قبلی';
    await h.service.cancel(1, 'درخواست مشتری', 'PENDING_PAYMENT');
    expect(h.prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELED', note: 'قبلی | لغو ادمین: درخواست مشتری' },
    });
    expect(h.stock.release).toHaveBeenCalledWith(expect.anything(), [
      { variantId: 10, quantity: 2 },
    ]);
    expect(h.prisma.order.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      h.stock.release.mock.invocationCallOrder[0],
    );
    expect(h.prisma.couponRedemption.deleteMany).toHaveBeenCalledWith({ where: { orderId: 1 } });
    expect(h.prisma.order.update).not.toHaveBeenCalled();
  });
  it.each(['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELED'])(
    'refuses cancellation of %s without stock movement',
    async (status) => {
      const h = makeService(status);
      await expect(h.service.cancel(1)).rejects.toMatchObject({ code: 'ORDER_INVALID_STATE' });
      expect(h.stock.release).not.toHaveBeenCalled();
      expect(h.prisma.order.updateMany).not.toHaveBeenCalled();
    },
  );
  it('rejects stale expected status before claiming and preserves legacy optional cancellation', async () => {
    const h = makeService('PENDING_PAYMENT');
    await expect(h.service.cancel(1, undefined, 'PAID')).rejects.toMatchObject({
      code: 'ORDER_STALE_STATE',
    });
    expect(h.stock.release).not.toHaveBeenCalled();
    await h.service.cancel(1);
    expect(h.stock.release).toHaveBeenCalledTimes(1);
  });
  it.each(['PAID', 'CANCELED'])(
    'does not release stock/coupon when another path wins with %s',
    async (winningStatus) => {
      const h = makeService('PENDING_PAYMENT');
      h.order.couponId = 5;
      h.prisma.order.updateMany.mockImplementationOnce(async () => {
        h.order.status = winningStatus;
        return { count: 0 };
      });
      await expect(h.service.cancel(1)).rejects.toMatchObject({ code: 'ORDER_STALE_STATE' });
      expect(h.stock.release).not.toHaveBeenCalled();
      expect(h.prisma.couponRedemption.deleteMany).not.toHaveBeenCalled();
      expect(h.order.status).toBe(winningStatus);
    },
  );
  it('releases stock/coupon only once for two concurrent administrator cancellations', async () => {
    const h = makeService('PENDING_PAYMENT');
    h.order.couponId = 5;
    const results = await Promise.allSettled([h.service.cancel(1), h.service.cancel(1)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(h.stock.release).toHaveBeenCalledTimes(1);
    expect(h.prisma.couponRedemption.deleteMany).toHaveBeenCalledTimes(1);
    expect(h.order.status).toBe('CANCELED');
  });
});

describe('Dedicated refund marker remains separate from status and stock', () => {
  it('requires successful payment and refuses an already recorded refund', async () => {
    const h = makeService('DELIVERED');
    h.order.payments = [{ status: 'FAILED' }];
    await expect(h.service.markRefunded(1, 'note')).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATE',
    });
    h.order.payments = [{ status: 'SUCCESS' }];
    h.order.refundedAt = new Date();
    await expect(h.service.markRefunded(1, 'note')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.prisma.order.update).not.toHaveBeenCalled();
  });
  it('marks late successful payment on a canceled order without reopening it or moving stock', async () => {
    const h = makeService('CANCELED');
    h.order.payments = [{ status: 'SUCCESS' }];
    await h.service.markRefunded(1, 'وجه خارج از سامانه مسترد شد');
    expect(h.order).toMatchObject({
      status: 'CANCELED',
      refundedAt: expect.any(Date),
      refundNote: 'وجه خارج از سامانه مسترد شد',
    });
    expect(h.stock.release).not.toHaveBeenCalled();
    expect(h.stock.reserve).not.toHaveBeenCalled();
  });
});

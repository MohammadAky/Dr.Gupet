import { AdminOrdersService } from './admin-orders.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

const baseOrder = {
  id: 1,
  orderNumber: 'DG-1',
  status: 'PAID',
  couponId: null,
  note: null,
  items: [{ variantId: 10, quantity: 2 }],
  payments: [],
};

function makeService(order: any, overrides: any = {}) {
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest
        .fn()
        .mockImplementation((args: any) => Promise.resolve({ ...order, ...args.data })),
    },
    couponRedemption: { deleteMany: jest.fn() },
    $transaction: (fn: (tx: any) => Promise<any>) => fn(prisma),
    ...overrides.prisma,
  };
  const orderStockService = {
    reserve: jest.fn(),
    release: jest.fn(),
  };
  return {
    service: new AdminOrdersService(prisma as any, orderStockService as any),
    prisma,
    orderStockService,
  };
}

describe('AdminOrdersService.transition', () => {
  it('moves PAID to PROCESSING', async () => {
    const { service, prisma } = makeService({ ...baseOrder, status: 'PAID' });
    const result = await service.transition(1, { to: 'PROCESSING' });
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'PROCESSING' }),
      }),
    );
    expect(result.status).toBe('PROCESSING');
  });

  it('rejects illegal jumps like PENDING_PAYMENT → DELIVERED', async () => {
    const { service } = makeService({ ...baseOrder, status: 'PENDING_PAYMENT' });
    await expect(service.transition(1, { to: 'DELIVERED' })).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATE',
    });
  });

  it('rejects skipping PROCESSING (PAID → SHIPPED)', async () => {
    const { service } = makeService({ ...baseOrder, status: 'PAID' });
    await expect(service.transition(1, { to: 'SHIPPED' })).rejects.toBeInstanceOf(AppException);
  });

  it('stamps shippedAt and tracking when moving to SHIPPED', async () => {
    const { service, prisma } = makeService({ ...baseOrder, status: 'PROCESSING' });
    await service.transition(1, { to: 'SHIPPED', trackingCode: 'IR1', shippingMethod: 'post' });
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SHIPPED',
          trackingCode: 'IR1',
          shippingMethod: 'post',
          shippedAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe('AdminOrdersService.cancel', () => {
  it('cancels PENDING_PAYMENT and releases stock', async () => {
    const { service, orderStockService, prisma } = makeService({
      ...baseOrder,
      status: 'PENDING_PAYMENT',
      couponId: 5,
    });
    await service.cancel(1, 'درخواست مشتری');
    expect(orderStockService.release).toHaveBeenCalledWith(expect.anything(), [
      { variantId: 10, quantity: 2 },
    ]);
    expect(prisma.couponRedemption.deleteMany).toHaveBeenCalled();
  });

  it('refuses to cancel a PAID order', async () => {
    const { service } = makeService({ ...baseOrder, status: 'PAID' });
    await expect(service.cancel(1)).rejects.toMatchObject({ code: 'ORDER_INVALID_STATE' });
  });
});

describe('AdminOrdersService.markRefunded', () => {
  it('requires a successful payment', async () => {
    const { service } = makeService({
      ...baseOrder,
      status: 'PAID',
      payments: [{ status: 'FAILED' }],
      refundedAt: null,
    });
    await expect(service.markRefunded(1, 'note')).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATE',
    });
  });

  it('refuses double refund', async () => {
    const { service } = makeService({
      ...baseOrder,
      status: 'DELIVERED',
      payments: [{ status: 'SUCCESS' }],
      refundedAt: new Date(),
    });
    await expect(service.markRefunded(1, 'note')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('marks refund with note', async () => {
    const { service, prisma } = makeService({
      ...baseOrder,
      status: 'DELIVERED',
      payments: [{ status: 'SUCCESS' }],
      refundedAt: null,
    });
    await service.markRefunded(1, 'استرداد شد');
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refundNote: 'استرداد شد', refundedAt: expect.any(Date) }),
      }),
    );
  });
});

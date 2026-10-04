import { OrdersService } from './orders.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

/**
 * Issue #02 — order/payment race: cancel and expiry must claim the status
 * transition atomically (`updateMany` guarded by `status: 'PENDING_PAYMENT'`)
 * and release stock exactly once.
 */

function makePrisma(opts: { claimCount?: number; order?: any; expired?: any[] } = {}) {
  const order = opts.order ?? {
    id: 7,
    orderNumber: 'DG-1',
    userId: 42,
    status: 'PENDING_PAYMENT',
    couponId: null,
    items: [
      { variantId: 11, quantity: 2 },
      { variantId: 12, quantity: 1 },
    ],
  };
  const prisma: any = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      findMany: jest.fn().mockResolvedValue(opts.expired ?? [order]),
      updateMany: jest.fn().mockResolvedValue({ count: opts.claimCount ?? 1 }),
      update: jest.fn().mockResolvedValue({ ...order, status: 'CANCELED' }),
    },
    couponRedemption: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    productVariant: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  return prisma;
}

function makeService(prisma: any) {
  const release = jest.fn().mockResolvedValue(undefined);
  const orderStockService = { release, reserve: jest.fn() };
  const cartService = {} as any;
  const couponsService = {} as any;
  const config = { get: () => 30 } as any;
  const settings = { getNumber: jest.fn().mockResolvedValue(30) };
  const service = new OrdersService(
    prisma,
    cartService,
    couponsService,
    orderStockService as any,
    config,
    settings as any,
  );
  return { service, release };
}

describe('OrdersService.cancel (issue #02)', () => {
  it('claims the transition atomically and releases stock exactly once', async () => {
    const prisma = makePrisma();
    const { service, release } = makeService(prisma);

    await service.cancel(42, 7);

    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 7, userId: 42, status: 'PENDING_PAYMENT' }),
        data: { status: 'CANCELED' },
      }),
    );
    expect(release).toHaveBeenCalledTimes(1);
    expect(release.mock.calls[0][1]).toEqual([
      { variantId: 11, quantity: 2 },
      { variantId: 12, quantity: 1 },
    ]);
  });

  it('does not release stock when another caller already transitioned the order', async () => {
    const prisma = makePrisma({ claimCount: 0 });
    const { service, release } = makeService(prisma);

    await expect(service.cancel(42, 7)).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATE',
    } as Partial<AppException>);
    expect(release).not.toHaveBeenCalled();
  });

  it('rejects other users and non-pending orders before touching anything', async () => {
    const prisma = makePrisma();
    const { service, release } = makeService(prisma);
    await expect(service.cancel(99, 7)).rejects.toThrow('سفارش یافت نشد');

    const prisma2 = makePrisma({
      order: { id: 7, orderNumber: 'DG-1', userId: 42, status: 'PAID', couponId: 3, items: [] },
    });
    const svc2 = makeService(prisma2);
    await expect(svc2.service.cancel(42, 7)).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATE',
    });
    expect(release).not.toHaveBeenCalled();
  });

  it('deletes coupon redemptions when the order had a coupon', async () => {
    const prisma = makePrisma({
      order: {
        id: 7,
        orderNumber: 'DG-1',
        userId: 42,
        status: 'PENDING_PAYMENT',
        couponId: 5,
        items: [],
      },
    });
    const { service } = makeService(prisma);
    await service.cancel(42, 7);
    expect(prisma.couponRedemption.deleteMany).toHaveBeenCalledWith({
      where: { orderId: 7 },
    });
  });
});

describe('OrdersService.expirePendingOrders (issue #02)', () => {
  it('releases stock only after a successful atomic claim', async () => {
    const prisma = makePrisma();
    const { service, release } = makeService(prisma);
    await service.expirePendingOrders();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('skips orders that were canceled/paid concurrently (claim fails)', async () => {
    const prisma = makePrisma({ claimCount: 0 });
    const { service, release } = makeService(prisma);
    await service.expirePendingOrders();
    expect(release).not.toHaveBeenCalled();
  });

  it('continues with remaining orders when one claim throws', async () => {
    const orderA = { id: 1, orderNumber: 'A', couponId: null, items: [] };
    const orderB = { id: 2, orderNumber: 'B', couponId: null, items: [] };
    const prisma = makePrisma({ expired: [orderA, orderB] });
    let calls = 0;
    prisma.order.updateMany = jest.fn().mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error('db glitch');
      return { count: 1 };
    });
    const { service, release } = makeService(prisma);
    await service.expirePendingOrders();
    expect(release).toHaveBeenCalledTimes(1); // order B still processed
  });
});

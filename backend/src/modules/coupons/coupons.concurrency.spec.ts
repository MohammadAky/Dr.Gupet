import { OrdersService } from '../orders/orders.service';
import { CouponsService } from './coupons.service';

/**
 * Issue #16 — redemption limits must hold for concurrent checkouts.
 *
 * The fake database serializes `$transaction` the way InnoDB serializes two
 * checkouts that lock the same coupon row, and only exposes redemptions that were
 * committed by an earlier transaction. This proves the service orders its reads
 * and writes correctly; it is not a MySQL concurrency acceptance run.
 */
function harness(totalLimit = 1, perUserLimit = 1) {
  const coupon = {
    id: 9,
    code: 'SAVE',
    isActive: true,
    startAt: null as Date | null,
    endAt: null as Date | null,
    minOrderAmount: null as number | null,
    totalLimit,
    perUserLimit,
    type: 'FIXED',
    value: 10000,
    maxDiscount: null as number | null,
  };
  const redemptions: Array<{ couponId: number; userId: number; orderId: number }> = [];
  let orders = 0;
  let tail: Promise<unknown> = Promise.resolve();

  const buildOrder = (id: number, data: Record<string, unknown>) => ({
    id,
    userId: 1,
    orderNumber: `ORD-${id}`,
    status: 'PENDING_PAYMENT',
    createdAt: new Date('2026-10-24T10:00:00.000Z'),
    items: [],
    ...data,
  });

  const db: any = {
    address: {
      findUnique: jest.fn().mockResolvedValue({
        id: 2,
        userId: 1,
        title: 'خانه',
        receiverName: 'سارا',
        receiverPhone: '09120000000',
        province: 'خراسان رضوی',
        city: 'مشهد',
        fullAddress: 'خیابان نمونه',
        postalCode: '1234567890',
      }),
    },
    cartItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          variantId: 5,
          quantity: 1,
          variant: { isActive: true, price: 200000, weightGram: 500, product: { isActive: true, name: 'غذا' } },
        },
      ]),
      deleteMany: jest.fn(),
    },
    order: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => buildOrder(++orders, data)),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderItem: { createMany: jest.fn() },
    coupon: {
      findUnique: jest.fn(async ({ where }: { where: { id?: number; code?: string } }) =>
        where.id === coupon.id || where.code === coupon.code ? { ...coupon } : null,
      ),
    },
    couponRedemption: {
      count: jest.fn(async ({ where }: { where: { couponId: number; userId?: number } }) =>
        redemptions.filter(
          (row) => row.couponId === where.couponId && (where.userId === undefined || row.userId === where.userId),
        ).length,
      ),
      create: jest.fn(async ({ data }: { data: { couponId: number; userId: number; orderId: number } }) => {
        // The unique orderId constraint is the last line of defence in MySQL.
        redemptions.push(data);
        return data;
      }),
      deleteMany: jest.fn(),
    },
    // The coupon row lock — recorded so the test can assert it is inside the transaction.
    $queryRaw: jest.fn().mockResolvedValue([{ id: coupon.id }]),
  };
  db.$transaction = jest.fn((callback: (tx: unknown) => Promise<unknown>) => {
    const run = tail.then(() => callback(db));
    tail = run.catch(() => undefined);
    return run;
  });

  const stock = { reserve: jest.fn().mockResolvedValue(undefined), release: jest.fn() };
  const settings = { getNumber: jest.fn(async (_key: string, fallback: number) => fallback) };
  const config = { get: jest.fn((key: string) => (key === 'payment.driver' ? 'mock' : undefined)) };
  const coupons = new CouponsService(db as any);
  const service = new OrdersService(
    db,
    { getCart: jest.fn().mockResolvedValue({ items: [{}] }) } as any,
    coupons,
    stock as any,
    config as any,
    settings as any,
  );

  return { service, coupons, db, redemptions, stock };
}

describe('Coupon redemption concurrency (issue #16)', () => {
  it('accepts exactly one of two simultaneous checkouts for the last remaining redemption', async () => {
    const h = harness(1, 1);
    const results = await Promise.allSettled([
      h.service.checkout(1, { addressId: 2, couponCode: 'SAVE' }),
      h.service.checkout(1, { addressId: 2, couponCode: 'SAVE' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ code: 'COUPON_LIMIT_REACHED' });
    expect(h.redemptions).toHaveLength(1);
    expect(h.db.order.create).toHaveBeenCalledTimes(1);
  });

  it('locks the coupon row inside the checkout transaction before counting limits', async () => {
    const h = harness(5, 1);
    await h.service.checkout(1, { addressId: 2, couponCode: 'save' });
    expect(h.db.$transaction).toHaveBeenCalledTimes(1);
    expect(h.db.$queryRaw).toHaveBeenCalledTimes(1);
    const query = (h.db.$queryRaw.mock.calls[0] as unknown[])[0] as { strings?: string[] };
    const text = (query.strings ?? []).join('?');
    expect(text).toContain('Coupon');
    expect(text).toContain('FOR UPDATE');
  });

  it('keeps the read-only coupon preview free of locks and writes', async () => {
    const h = harness(5, 1);
    await expect(h.coupons.validate('SAVE', 1, 200000)).resolves.toMatchObject({ discountAmount: 10000 });
    expect(h.db.$queryRaw).not.toHaveBeenCalled();
    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(h.db.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('rejects an over-limit coupon without reserving stock or creating an order', async () => {
    const h = harness(1, 1);
    await h.service.checkout(1, { addressId: 2, couponCode: 'SAVE' });
    h.stock.reserve.mockClear();
    await expect(h.service.checkout(1, { addressId: 2, couponCode: 'SAVE' })).rejects.toMatchObject({
      code: 'COUPON_LIMIT_REACHED',
    });
    expect(h.stock.reserve).not.toHaveBeenCalled();
    expect(h.redemptions).toHaveLength(1);
    expect(h.db.order.create).toHaveBeenCalledTimes(1);
  });
});

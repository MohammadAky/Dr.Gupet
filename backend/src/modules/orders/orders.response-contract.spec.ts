import { OrdersService } from './orders.service';
import { AdminOrdersService } from './admin-orders.service';
import { parseAddressSnapshot } from './address-snapshot';

const snapshot = {
  title: 'خانه',
  receiverName: 'سارا',
  receiverPhone: '09120000000',
  province: 'خراسان رضوی',
  city: 'مشهد',
  fullAddress: 'خیابان نمونه پلاک ۱۰',
  postalCode: null,
};
const createdAt = new Date('2026-10-10T10:00:00.000Z');

function setup(minutes?: number) {
  let stored = {
    id: 7,
    userId: 1,
    status: 'PENDING_PAYMENT',
    createdAt,
    addressSnapshot: JSON.stringify(snapshot),
    items: [{ variantId: 5, quantity: 2 }],
    couponId: null,
    finalAmount: 250000,
  };
  const prisma: any = {
    address: { findUnique: jest.fn().mockResolvedValue({ ...snapshot, id: 2, userId: 1 }) },
    cartItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          variantId: 5,
          quantity: 2,
          variant: {
            isActive: true,
            price: 100000,
            weightGram: 500,
            product: { isActive: true, name: 'غذا' },
          },
        },
      ]),
      deleteMany: jest.fn(),
    },
    order: {
      create: jest.fn(async ({ data }: { data: typeof stored }) => {
        if (typeof data.addressSnapshot !== 'string') throw new Error('TEXT requires string');
        stored = { ...stored, ...data };
        return stored;
      }),
      findUnique: jest.fn(async () => stored),
      findMany: jest.fn(async () => [stored]),
      count: jest.fn().mockResolvedValue(1),
      updateMany: jest.fn(async () => {
        stored = { ...stored, status: 'CANCELED' };
        return { count: 1 };
      }),
    },
    orderItem: { createMany: jest.fn() },
    couponRedemption: { deleteMany: jest.fn(), create: jest.fn() },
  };
  prisma.$transaction = jest.fn((callback: (tx: any) => Promise<unknown>) => callback(prisma));
  const stock = { reserve: jest.fn(), release: jest.fn() };
  const config = {
    get: jest.fn((key: string) =>
      key === 'payment.driver' ? 'mock' : key === 'app.orderExpireMinutes' ? 20 : undefined,
    ),
  };
  const settings = {
    getNumber: jest.fn(async (key: string, fallback: number) =>
      key === 'ORDER_EXPIRE_MINUTES' ? (minutes ?? fallback) : fallback,
    ),
  };
  const service = new OrdersService(
    prisma,
    { getCart: jest.fn().mockResolvedValue({ items: [{}] }) } as any,
    {} as any,
    stock as any,
    config as any,
    settings as any,
  );
  return { service, prisma, stock, settings, config, stored: () => stored };
}

describe('order TEXT snapshot and server expiry contract', () => {
  it('serializes checkout snapshot for MySQL TEXT and returns an independent valid object', async () => {
    const { service, prisma, stock } = setup(45);
    const response = await service.checkout(1, { addressId: 2, note: 'عصر' });
    const input = prisma.order.create.mock.calls[0][0].data;
    expect(typeof input.addressSnapshot).toBe('string');
    expect(JSON.parse(input.addressSnapshot)).toEqual(snapshot);
    expect(response.addressSnapshot).toEqual(snapshot);
    expect(response.finalAmount).toBe(250000);
    expect(response.expiresAt).toBe('2026-10-10T10:45:00.000Z');
    expect(stock.reserve).toHaveBeenCalledWith(prisma, [{ variantId: 5, quantity: 2 }]);
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cart: { userId: 1 } } });
    prisma.address.findUnique.mockResolvedValue({ ...snapshot, fullAddress: 'نشانی جدید' });
    expect((await service.findOne(1, 7)).addressSnapshot?.fullAddress).toBe(snapshot.fullAddress);
  });
  it('normalizes customer and admin detail responses with the same snapshot contract', async () => {
    const { service, prisma, stock } = setup();
    const customer = await service.findOne(1, 7);
    const admin = await new AdminOrdersService(prisma, stock as any).findOneAdmin(7);
    expect(customer.addressSnapshot).toEqual(snapshot);
    expect(admin.addressSnapshot).toEqual(snapshot);
  });
  it('uses the same effective database override for the reported deadline and expiration cutoff', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-10T11:00:00.000Z').getTime());
    try {
      const { service, prisma, settings } = setup(45);
      expect((await service.findOne(1, 7)).expiresAt).toBe('2026-10-10T10:45:00.000Z');
      prisma.order.findMany.mockResolvedValue([]);
      await service.expirePendingOrders();
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING_PAYMENT',
            createdAt: { lt: new Date('2026-10-10T10:15:00.000Z') },
          },
        }),
      );
      expect(settings.getNumber).toHaveBeenNthCalledWith(1, 'ORDER_EXPIRE_MINUTES', 20);
      expect(settings.getNumber).toHaveBeenNthCalledWith(2, 'ORDER_EXPIRE_MINUTES', 20);
    } finally {
      jest.restoreAllMocks();
    }
  });
  it('uses the configured fallback and provides no deadline for canceled orders', async () => {
    const { service } = setup();
    expect((await service.findOne(1, 7)).expiresAt).toBe('2026-10-10T10:20:00.000Z');
    const canceled = await service.cancel(1, 7);
    expect(canceled?.expiresAt).toBeNull();
    expect(canceled?.addressSnapshot).toEqual(snapshot);
  });
  it('keeps order and delivery address ownership guards before normalization or writes', async () => {
    const { service, prisma, settings } = setup();
    await expect(service.findOne(2, 7)).rejects.toThrow('سفارش یافت نشد');
    expect(settings.getNumber).not.toHaveBeenCalled();
    await expect(service.checkout(2, { addressId: 2 })).rejects.toThrow('آدرس یافت نشد');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each(['not json', '{"city":"مشهد"}', '[]', 'null'])(
    'reports malformed historical snapshot %s as unavailable without changing money',
    async (value) => {
      const { service, prisma, stored } = setup();
      prisma.order.findUnique.mockResolvedValue({
        ...stored(),
        addressSnapshot: value,
        status: 'PAID',
      });
      const response = await service.findOne(1, 7);
      expect(response.addressSnapshot).toBeNull();
      expect(response.finalAmount).toBe(250000);
      expect(response.expiresAt).toBeNull();
    },
  );
  it('rejects malformed snapshot shapes and removes unrelated private address fields', () => {
    expect(parseAddressSnapshot({ ...snapshot, userId: 9 })).toEqual(snapshot);
    expect(parseAddressSnapshot({ ...snapshot, receiverPhone: 123 })).toBeNull();
  });
});

import { AdminCouponsService } from './admin-coupons.service';

function makeService(coupon: any = null) {
  const prisma = {
    coupon: {
      findUnique: jest.fn().mockResolvedValue(coupon),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 1, ...args.data })),
      update: jest.fn().mockResolvedValue({ id: 1 }),
      delete: jest.fn().mockResolvedValue({ id: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    couponRedemption: { groupBy: jest.fn().mockResolvedValue([]) },
  };
  return { service: new AdminCouponsService(prisma as any), prisma };
}

describe('AdminCouponsService.create', () => {
  it('uppercases the coupon code', async () => {
    const { service, prisma } = makeService();
    const coupon = await service.create({
      code: 'summer20',
      type: 'PERCENT',
      value: 20,
    } as any);
    expect(coupon.code).toBe('SUMMER20');
    expect(prisma.coupon.create).toHaveBeenCalled();
  });

  it('rejects PERCENT above 100', async () => {
    const { service } = makeService();
    await expect(
      service.create({ code: 'X', type: 'PERCENT', value: 150 } as any),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects duplicate codes', async () => {
    const { service } = makeService();
    (service as any).prisma.coupon.findUnique = jest.fn().mockResolvedValue({ id: 9 });
    await expect(
      service.create({ code: 'X', type: 'FIXED', value: 1000 } as any),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('AdminCouponsService.remove', () => {
  it('deactivates instead of deleting when the coupon was used', async () => {
    const { service, prisma } = makeService({ id: 1, code: 'USED', _count: { redemptions: 3 } });
    const result = await service.remove(1);
    expect(result.deleted).toBe(false);
    expect(result.deactivated).toBe(true);
    expect(prisma.coupon.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
    expect(prisma.coupon.delete).not.toHaveBeenCalled();
  });

  it('hard-deletes unused coupons', async () => {
    const { service, prisma } = makeService({ id: 2, code: 'NEW', _count: { redemptions: 0 } });
    const result = await service.remove(2);
    expect(result.deleted).toBe(true);
    expect(prisma.coupon.delete).toHaveBeenCalled();
  });
});

import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AddressesService } from '../addresses/addresses.service';

/**
 * Two-user isolation: user 2's resources must be invisible/untouchable for user 1.
 * Issue #3: without a userId filter (the `undefined userId` bug) the first row
 * would leak across users — these tests fail loudly if the filter disappears.
 */
function makeService() {
  const orders = [
    { id: 101, userId: 1, orderNumber: 'A', status: 'PENDING', items: [], createdAt: new Date() },
    { id: 102, userId: 2, orderNumber: 'B', status: 'PAID', items: [], createdAt: new Date() },
  ];
  const addresses = [
    { id: 201, userId: 1, city: 'تهران' },
    { id: 202, userId: 2, city: 'مشهد' },
  ];

  const prisma: any = {
    order: {
      findUnique: jest.fn().mockImplementation(async (args: any) => {
        return orders.find((o) => o.id === args.where.id) ?? null;
      }),
      findFirst: jest.fn().mockImplementation(async (args: any) => {
        return (
          orders.find((o) =>
            Object.entries(args.where ?? {}).every(([k, v]) => (o as any)[k] === v),
          ) ?? null
        );
      }),
      findMany: jest
        .fn()
        .mockImplementation(async (args: any) =>
          orders.filter((o) =>
            Object.entries(args.where ?? {}).every(([k, v]) => (o as any)[k] === v),
          ),
        ),
      count: jest
        .fn()
        .mockImplementation(
          async (args: any) =>
            orders.filter((o) =>
              Object.entries(args.where ?? {}).every(([k, v]) => (o as any)[k] === v),
            ).length,
        ),
    },
    address: {
      findFirst: jest.fn().mockImplementation(async (args: any) => {
        return (
          addresses.find((a) =>
            Object.entries(args.where ?? {}).every(([k, v]) => (a as any)[k] === v),
          ) ?? null
        );
      }),
    },
  };

  const service = new OrdersService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {
      get: () => undefined,
    } as any,
    { getNumber: async () => 0 } as any,
  );
  return { service, prisma, orders, addresses };
}

describe('Orders two-user isolation (issue #3)', () => {
  it("user 1 cannot read user 2's order", async () => {
    const { service } = makeService();
    await expect(service.findOne(1, 102)).rejects.toThrow(NotFoundException);
  });

  it('each user gets only their own orders', async () => {
    const { service } = makeService();
    const result = await service.findAll(1, 1, 20);
    expect(result.data.map((o: any) => o.id)).toEqual([101]);
  });

  it('a missing identity (undefined userId) must not leak any order', async () => {
    const { service } = makeService();
    // Even if a controller leaked `undefined` through, both users' orders must
    // stay unreachable — the service must reject instead of returning data.
    await expect(service.findOne(undefined as any, 101)).rejects.toThrow(NotFoundException);
    await expect(service.findOne(undefined as any, 102)).rejects.toThrow(NotFoundException);
    const result = await service.findAll(undefined as any, 1, 20);
    expect(result.data).toEqual([]);
  });

  it("status filter narrows within the user's own orders only", async () => {
    const { service } = makeService();
    const paid = await service.findAll(1, 1, 20, 'PAID');
    expect(paid.data).toEqual([]);
    const paid2 = await service.findAll(2, 1, 20, 'PAID');
    expect(paid2.data.map((o: any) => o.id)).toEqual([102]);
  });
});

describe('Addresses two-user isolation (issue #3)', () => {
  function makeAddressService() {
    const addresses = [
      { id: 201, userId: 1, city: 'تهران', isDefault: true },
      { id: 202, userId: 2, city: 'مشهد', isDefault: true },
    ];
    const prisma: any = {
      address: {
        findUnique: jest
          .fn()
          .mockImplementation(
            async (args: any) => addresses.find((a) => a.id === args.where.id) ?? null,
          ),
        update: jest.fn().mockImplementation(async (args: any) => ({
          ...addresses.find((a) => a.id === args.where.id),
          ...args.data,
        })),
        delete: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
      },
    };
    return { service: new AddressesService(prisma), prisma };
  }

  it("user 1 cannot update user 2's address", async () => {
    const { service, prisma } = makeAddressService();
    await expect(service.update(1, 202, { city: 'اصفهان' })).rejects.toThrow(NotFoundException);
    // nothing was written
    expect(prisma.address.update).not.toHaveBeenCalled();
  });

  it("user 1 cannot delete user 2's address", async () => {
    const { service, prisma } = makeAddressService();
    await expect(service.remove(1, 202)).rejects.toThrow(NotFoundException);
    expect(prisma.address.delete).not.toHaveBeenCalled();
  });

  it('user 1 can update their own address', async () => {
    const { service, prisma } = makeAddressService();
    await expect(service.update(1, 201, { city: 'اصفهان' })).resolves.toMatchObject({
      id: 201,
      city: 'اصفهان',
    });
    expect(prisma.address.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 201 } }),
    );
  });
});

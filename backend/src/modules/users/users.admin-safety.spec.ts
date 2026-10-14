import { UsersService } from './users.service';

function harness(admins = [{ id: 1 }, { id: 2 }]) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue(admins),
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 2 }),
      update: jest.fn().mockResolvedValue({ id: 2, role: 'USER' }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { service: new UsersService(prisma as any), tx, prisma };
}

describe('Server-side administrator access protection', () => {
  it.each([{ role: 'USER' }, { status: 'BLOCKED' }])(
    'rejects self access removal %j',
    async (data) => {
      const h = harness();
      await expect(h.service.updateByAdmin(2, data, 2)).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(h.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects self deletion independently of the UI', async () => {
    const h = harness();
    await expect(h.service.softDeleteByAdmin(2, 2)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.tx.user.update).not.toHaveBeenCalled();
  });

  it('prevents demotion, blocking and deletion of the last active admin', async () => {
    const h = harness([{ id: 2 }]);
    await expect(h.service.updateByAdmin(2, { role: 'USER' }, 1)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(h.service.updateByAdmin(2, { status: 'BLOCKED' }, 1)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(h.service.softDeleteByAdmin(2, 1)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.tx.user.update).not.toHaveBeenCalled();
  });

  it('permits another admin to remove access while another active admin remains', async () => {
    const h = harness();
    await h.service.updateByAdmin(2, { role: 'USER' }, 1);
    expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(h.tx.user.update).toHaveBeenCalledTimes(1);
  });

  it('soft-deletes a blocked user without deleting related records or credentials', async () => {
    const h = harness();
    h.tx.$queryRaw
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ status: 'BLOCKED', deletedAt: null }]);
    expect(await h.service.softDeleteByAdmin(2, 1)).toEqual({ deleted: true });
    expect(h.tx.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { deletedAt: expect.any(Date), status: 'BLOCKED' },
      select: { id: true },
    });
    expect(h.tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it.each([
    { status: 'ACTIVE', deletedAt: null },
    { status: 'BLOCKED', deletedAt: new Date() },
  ])('rejects nonblocked or already deleted users %j under the transaction lock', async (user) => {
    const h = harness();
    h.tx.$queryRaw.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([user]);
    await expect(h.service.softDeleteByAdmin(2, 1)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.tx.user.update).not.toHaveBeenCalled();
  });
});

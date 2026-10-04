import { UsersService } from './users.service';

/**
 * Issue #10 — admin user creation: phone normalization + validation,
 * role whitelist, unique phone.
 */

function makePrisma(existing: any = null) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockImplementation(async ({ data, select }: any) => ({ id: 1, ...data })),
    },
  } as any;
}

function makeService(prisma: any) {
  return new UsersService(prisma);
}

describe('UsersService.createByAdmin (issue #10)', () => {
  it('normalizes Iranian mobile formats to 09xxxxxxxxx', async () => {
    for (const input of ['09121234567', '9121234567', '989121234567', '00989121234567']) {
      const prisma = makePrisma();
      const service = makeService(prisma);
      await service.createByAdmin({ phone: input, role: 'USER' });
      expect(prisma.user.create.mock.calls[0][0].data.phone).toBe('09121234567');
    }
  });

  it('rejects invalid phone numbers', async () => {
    const service = makeService(makePrisma());
    for (const bad of ['123', '08121234567', '091212345', 'abc']) {
      await expect(service.createByAdmin({ phone: bad })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    }
  });

  it('rejects unknown roles', async () => {
    const service = makeService(makePrisma());
    await expect(
      service.createByAdmin({ phone: '09121234567', role: 'SUPERADMIN' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('defaults the role to USER and keeps provided names', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.createByAdmin({ phone: '09121234567', firstName: 'سارا', lastName: 'کریمی' });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      phone: '09121234567',
      role: 'USER',
      firstName: 'سارا',
      lastName: 'کریمی',
    });
  });

  it('rejects duplicate phones with CONFLICT', async () => {
    const service = makeService(makePrisma({ id: 5, phone: '09121234567' }));
    await expect(service.createByAdmin({ phone: '09121234567' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

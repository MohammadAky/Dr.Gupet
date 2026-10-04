import { SmsLogsService } from './sms-logs.service';

/**
 * Read-side of the SmsLog delivery log (phase 2): filters + pagination shape.
 */
function makePrisma(rows: any[] = []) {
  return {
    smsLog: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(rows.length),
    },
  } as any;
}

describe('SmsLogsService.findAllAdmin', () => {
  it('returns { data, meta } with pagination info', async () => {
    const prisma = makePrisma([{ id: 1 }]);
    const service = new SmsLogsService(prisma);
    const result = await service.findAllAdmin({ page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(prisma.smsLog.findMany.mock.calls[0][0]).toMatchObject({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('filters by phone (contains), kind and status', async () => {
    const prisma = makePrisma();
    const service = new SmsLogsService(prisma);
    await service.findAllAdmin({ phone: '0912', kind: 'OTP', status: 'FAILED' });
    expect(prisma.smsLog.findMany.mock.calls[0][0].where).toEqual({
      phone: { contains: '0912' },
      kind: 'OTP',
      status: 'FAILED',
    });
  });

  it('computes skip/page arithmetic correctly', async () => {
    const prisma = makePrisma();
    const service = new SmsLogsService(prisma);
    await service.findAllAdmin({ page: 3, limit: 10 });
    expect(prisma.smsLog.findMany.mock.calls[0][0]).toMatchObject({ skip: 20, take: 10 });
  });
});

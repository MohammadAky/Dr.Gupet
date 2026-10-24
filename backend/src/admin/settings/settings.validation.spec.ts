import { SettingsService, parseSettingValue } from './settings.service';

/**
 * Issue #17 — operational numbers must be validated at the boundary, and a bad
 * stored row must never reach cart/order math.
 */
function harness(stored: Record<string, string> = {}) {
  const rows = new Map(Object.entries(stored));
  const prisma = {
    setting: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
        rows.has(where.key) ? { key: where.key, value: rows.get(where.key)! } : null,
      ),
      deleteMany: jest.fn(async ({ where }: { where: { key: string } }) => {
        const existed = rows.delete(where.key);
        return { count: existed ? 1 : 0 };
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        rows.set(where.key, rows.has(where.key) ? update.value : create.value);
        return { key: where.key, value: rows.get(where.key) };
      }),
    },
  };
  return { service: new SettingsService(prisma as any), prisma, rows };
}

describe('Runtime numeric settings (issue #17)', () => {
  it.each([
    ['SHIPPING_FLAT_COST', '0', 0],
    ['SHIPPING_FLAT_COST', '50000', 50000],
    ['FREE_SHIPPING_THRESHOLD', '6000000', 6000000],
    ['ORDER_EXPIRE_MINUTES', '1', 1],
    ['ORDER_EXPIRE_MINUTES', '1440', 1440],
  ] as const)('accepts %s=%s', async (key, value, parsed) => {
    expect(parseSettingValue(key, value)).toBe(parsed);
    const h = harness();
    await expect(h.service.set(key, value)).resolves.toMatchObject({ key, value });
    expect(await h.service.getNumber(key, 42)).toBe(parsed);
  });

  it.each([
    ['SHIPPING_FLAT_COST', '-1'],
    ['SHIPPING_FLAT_COST', '1.5'],
    ['SHIPPING_FLAT_COST', '۵۰۰۰۰'],
    ['SHIPPING_FLAT_COST', ''],
    ['SHIPPING_FLAT_COST', '2147483648'],
    ['FREE_SHIPPING_THRESHOLD', '12abc'],
    ['ORDER_EXPIRE_MINUTES', '0'],
    ['ORDER_EXPIRE_MINUTES', '1441'],
    ['ORDER_EXPIRE_MINUTES', '2.5'],
  ] as const)('rejects %s=%s before it is stored', async (key, value) => {
    expect(parseSettingValue(key, value)).toBeNull();
    const h = harness();
    await expect(h.service.set(key, value)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });
    expect(h.prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it('rejects an unknown key at the service boundary too', async () => {
    const h = harness();
    await expect(h.service.set('DATABASE_URL', '1000')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(h.prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['SHIPPING_FLAT_COST', '-5000'],
    ['SHIPPING_FLAT_COST', '1.5'],
    ['FREE_SHIPPING_THRESHOLD', 'NaN'],
    ['ORDER_EXPIRE_MINUTES', '0'],
    ['ORDER_EXPIRE_MINUTES', '999999'],
  ] as const)('ignores a hand-edited invalid %s=%s row and uses the fallback', async (key, value) => {
    const h = harness({ [key]: value });
    expect(await h.service.getNumber(key, 777)).toBe(777);
  });

  it('keeps a valid stored override above the fallback and refreshes the cache after a write', async () => {
    const h = harness({ SHIPPING_FLAT_COST: '60000' });
    expect(await h.service.getNumber('SHIPPING_FLAT_COST', 50000)).toBe(60000);
    await h.service.set('SHIPPING_FLAT_COST', '70000');
    expect(await h.service.getNumber('SHIPPING_FLAT_COST', 50000)).toBe(70000);
    await h.service.remove('SHIPPING_FLAT_COST');
    expect(await h.service.getNumber('SHIPPING_FLAT_COST', 50000)).toBe(50000);
  });
});

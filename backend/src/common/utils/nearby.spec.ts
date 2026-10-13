import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NearbyClinicDto, NearbyPharmacyDto } from '../dto/nearby.dto';
import { nearbyDirectory } from './nearby.util';

describe('Permission-based nearby directories', () => {
  it.each([
    {},
    { lat: 35 },
    { lat: '35', lng: 51 },
    { lat: 91, lng: 51 },
    { lat: 35, lng: -181 },
    { lat: NaN, lng: 51 },
    { lat: 35, lng: Infinity },
  ])('rejects missing, string and out-of-range coordinates: %j', async (body) => {
    expect((await validate(plainToInstance(NearbyClinicDto, body))).length).toBeGreaterThan(0);
  });

  it('accepts genuine zero coordinates and rejects unsupported sampleOnly', async () => {
    expect(
      await validate(plainToInstance(NearbyPharmacyDto, { lat: 0, lng: 0, limit: 2 })),
    ).toEqual([]);
    expect(
      (
        await validate(plainToInstance(NearbyPharmacyDto, { lat: 35, lng: 51, sampleOnly: true }), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });

  it.each(['Clinic', 'Pharmacy'] as const)(
    'ranks all matching %s rows before pagination and preserves SQL rank',
    async (kind) => {
      const queryRaw = jest
        .fn()
        .mockResolvedValueOnce([
          { id: 8, distanceKm: 0.2 },
          { id: 3, distanceKm: 1.8 },
        ])
        .mockResolvedValueOnce([{ total: 12n }]);
      const findMany = jest.fn().mockResolvedValue([
        { id: 3, name: 'دورتر' },
        { id: 8, name: 'نزدیک‌تر' },
      ]);
      const prisma: any = { $queryRaw: queryRaw, clinic: { findMany }, pharmacy: { findMany } };
      const result = await nearbyDirectory(prisma, kind, {
        lat: 35.5,
        lng: 51.5,
        page: 2,
        limit: 2,
        q: 'test" OR 1=1',
        is24h: false,
      });
      const sql = queryRaw.mock.calls[0][0];
      expect(sql.sql).toMatch(/ORDER BY distanceKm ASC, id ASC LIMIT \? OFFSET \?/);
      expect(sql.sql).toContain('lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180');
      expect(sql.sql).not.toContain('35.5');
      expect(sql.sql).not.toContain('OR 1=1');
      expect(sql.values).toContain('%test" OR 1=1%');
      expect(sql.values.slice(-2)).toEqual([2, 2]);
      expect(result.data.map((row) => [row.id, row.distanceKm])).toEqual([
        [8, 0.2],
        [3, 1.8],
      ]);
      expect(result.meta).toEqual({ page: 2, limit: 2, total: 12, totalPages: 6 });
      expect(findMany.mock.calls[0][0].where).toEqual({ id: { in: [8, 3] }, isActive: true });
      if (kind === 'Pharmacy') expect(sql.sql).toContain('name NOT LIKE');
    },
  );
});

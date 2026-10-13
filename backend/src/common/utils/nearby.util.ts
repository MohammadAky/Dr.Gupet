import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PRESENTATION_LABEL } from './presentation-sample.util';
import { normalizeFa } from './normalize-fa.util';

export interface NearbyQuery {
  lat: number;
  lng: number;
  page?: number;
  limit?: number;
  q?: string;
  city?: string;
  province?: string;
  is24h?: boolean;
  onDuty?: boolean;
}

/** Entire matching directory is ranked in SQL, before LIMIT/OFFSET. No coordinates are stored. */
export async function nearbyDirectory(
  prisma: PrismaService,
  kind: 'Clinic' | 'Pharmacy',
  query: NearbyQuery,
) {
  const { lat, lng, page = 1, limit = 20 } = query;
  if (
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90 ||
    !Number.isFinite(lng) ||
    Math.abs(lng) > 180 ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    throw new BadRequestException('موقعیت یا صفحه‌بندی معتبر نیست');
  // Only this closed table union is interpolated as SQL; all user input is bound.
  const table = kind === 'Clinic' ? Prisma.sql`\`Clinic\`` : Prisma.sql`\`Pharmacy\``;
  const clauses = [
    Prisma.sql`isActive = true`,
    Prisma.sql`lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180`,
  ];
  for (const field of ['q', 'city', 'province'] as const) {
    if (!query[field]) continue;
    const column =
      field === 'q' ? Prisma.sql`name` : field === 'city' ? Prisma.sql`city` : Prisma.sql`province`;
    clauses.push(Prisma.sql`${column} LIKE ${`%${normalizeFa(query[field]!)}%`}`);
  }
  if (query.is24h !== undefined) clauses.push(Prisma.sql`is24h = ${query.is24h}`);
  if (kind === 'Pharmacy' && query.onDuty !== undefined)
    clauses.push(Prisma.sql`onDuty = ${query.onDuty}`);
  if (kind === 'Pharmacy') clauses.push(Prisma.sql`name NOT LIKE ${`%— ${PRESENTATION_LABEL}`}`);
  const where = Prisma.join(clauses, ' AND ');
  const distance = Prisma.sql`6371.0088 * 2 * ASIN(SQRT(LEAST(1,
    POWER(SIN(RADIANS(lat - ${lat}) / 2), 2) +
    COS(RADIANS(${lat})) * COS(RADIANS(lat)) * POWER(SIN(RADIANS(lng - ${lng}) / 2), 2))))`;
  const [ranked, counts] = await Promise.all([
    prisma.$queryRaw<{ id: number; distanceKm: number }[]>(Prisma.sql`
      SELECT id, ${distance} AS distanceKm FROM ${table} WHERE ${where}
      ORDER BY distanceKm ASC, id ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    prisma.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`,
    ),
  ]);
  const select = {
    id: true,
    name: true,
    city: true,
    province: true,
    address: true,
    phone: true,
    is24h: true,
    isVerified: true,
    lat: true,
    lng: true,
  } as const;
  const ids = ranked.map((row) => row.id);
  const rows =
    kind === 'Clinic'
      ? await prisma.clinic.findMany({ where: { id: { in: ids }, isActive: true }, select })
      : await prisma.pharmacy.findMany({
          where: { id: { in: ids }, isActive: true },
          select: { ...select, onDuty: true },
        });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const total = Number(counts[0]?.total ?? 0);
  return {
    data: ranked.flatMap(({ id, distanceKm }) => {
      const row = byId.get(id);
      return row ? [{ ...row, distanceKm }] : [];
    }),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

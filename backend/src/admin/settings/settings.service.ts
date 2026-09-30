import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const SETTING_KEYS = [
  'SHIPPING_FLAT_COST',
  'FREE_SHIPPING_THRESHOLD',
  'ORDER_EXPIRE_MINUTES',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

const CACHE_TTL_MS = 30_000;

/**
 * Runtime settings stored in the Setting table.
 * A stored value overrides the env/config fallback so admins can change
 * operational numbers without a redeploy.
 */
@Injectable()
export class SettingsService {
  private cache = new Map<string, { value: string; loadedAt: number }>();

  constructor(private prisma: PrismaService) {}

  async getRaw(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (row) {
      this.cache.set(key, { value: row.value, loadedAt: Date.now() });
      return row.value;
    }

    this.cache.delete(key);
    return null;
  }

  /** Number setting: DB value wins; otherwise the provided fallback (usually env). */
  async getNumber(key: SettingKey, fallback: number): Promise<number> {
    const raw = await this.getRaw(key);
    if (raw == null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async findAll() {
    const rows = await this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
    return {
      data: rows.map((row) => ({
        key: row.key,
        value: row.value,
        updatedAt: row.updatedAt,
        overridable: (SETTING_KEYS as readonly string[]).includes(row.key),
      })),
      meta: {
        page: 1,
        limit: rows.length,
        total: rows.length,
        totalPages: 1,
      },
    };
  }

  async set(key: string, value: string) {
    const row = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    this.cache.delete(key);
    return row;
  }

  async remove(key: string) {
    await this.prisma.setting.deleteMany({ where: { key } });
    this.cache.delete(key);
    return { deleted: true };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

export const SETTING_KEYS = [
  'SHIPPING_FLAT_COST',
  'FREE_SHIPPING_THRESHOLD',
  'ORDER_EXPIRE_MINUTES',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/**
 * Accepted numeric range for each overridable setting (issue #17). Money values
 * are integer Toman; the expiry window is a positive whole number of minutes.
 * Values are validated on write and re-checked on read so a hand-edited row can
 * never feed a negative, fractional or absurd number into cart/order math.
 */
export const SETTING_BOUNDS: Record<SettingKey, { min: number; max: number; label: string }> = {
  SHIPPING_FLAT_COST: { min: 0, max: 2147483647, label: 'هزینهٔ ارسال' },
  FREE_SHIPPING_THRESHOLD: { min: 0, max: 2147483647, label: 'آستانهٔ ارسال رایگان' },
  ORDER_EXPIRE_MINUTES: { min: 1, max: 1440, label: 'مهلت پرداخت' },
};

export function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key);
}

/** Integer-only parse inside the documented bounds; null when out of contract. */
export function parseSettingValue(key: SettingKey, raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  const bounds = SETTING_BOUNDS[key];
  return Number.isSafeInteger(value) && value >= bounds.min && value <= bounds.max ? value : null;
}

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

  /**
   * Number setting: a stored value wins only while it still satisfies the
   * documented integer bounds; otherwise the fallback (usually env) applies.
   */
  async getNumber(key: SettingKey, fallback: number): Promise<number> {
    const raw = await this.getRaw(key);
    if (raw == null) return fallback;
    return parseSettingValue(key, raw) ?? fallback;
  }

  async findAll() {
    const rows = await this.prisma.setting.findMany({
      where: { key: { not: 'STOREFRONT_POPUP_V1' } },
      orderBy: { key: 'asc' },
    });
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
    if (!isSettingKey(key)) {
      throw new AppException('VALIDATION_ERROR', 'کلید تنظیمات نامعتبر است', 400);
    }
    if (parseSettingValue(key, value) === null) {
      const bounds = SETTING_BOUNDS[key];
      throw new AppException(
        'VALIDATION_ERROR',
        `${bounds.label} باید عدد صحیح بین ${bounds.min.toLocaleString('fa-IR')} و ${bounds.max.toLocaleString('fa-IR')} باشد`,
        400,
      );
    }
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

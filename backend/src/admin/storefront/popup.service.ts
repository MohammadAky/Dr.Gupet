import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { PopupDto, POPUP_IMAGE_PATH } from './popup.dto';

export const POPUP_SETTING_KEY = 'STOREFRONT_POPUP_V1';
export const EMPTY_POPUP = { enabled: false, title: '', body: '', image: '' };

/** Dedicated content contract; never exposes the operational settings table publicly. */
@Injectable()
export class PopupService {
  constructor(private readonly prisma: PrismaService) {}

  async read() {
    const row = await this.prisma.setting.findUnique({ where: { key: POPUP_SETTING_KEY } });
    if (!row) return { ...EMPTY_POPUP };
    try {
      const value: unknown = JSON.parse(row.value);
      if (!this.valid(value)) return { ...EMPTY_POPUP };
      return { enabled: value.enabled, title: value.title, body: value.body, image: value.image };
    } catch {
      return { ...EMPTY_POPUP };
    }
  }

  private valid(value: unknown): value is PopupDto {
    if (!value || typeof value !== 'object') return false;
    const item = value as Record<string, unknown>;
    return (
      typeof item.enabled === 'boolean' &&
      typeof item.title === 'string' &&
      item.title.length <= 90 &&
      typeof item.body === 'string' &&
      item.body.length <= 800 &&
      typeof item.image === 'string' &&
      item.image.length <= 500 &&
      POPUP_IMAGE_PATH.test(item.image) &&
      (!item.enabled || Boolean(item.title.trim() && item.body.trim()))
    );
  }

  async save(value: PopupDto) {
    if (!this.valid(value))
      throw new AppException('VALIDATION_ERROR', 'عنوان و متن پاپ‌آپ را کامل کنید', 400);
    const content = {
      enabled: value.enabled,
      title: value.title.trim(),
      body: value.body.trim(),
      image: value.image,
    };
    await this.prisma.setting.upsert({
      where: { key: POPUP_SETTING_KEY },
      create: { key: POPUP_SETTING_KEY, value: JSON.stringify(content) },
      update: { value: JSON.stringify(content) },
    });
    return content;
  }
}

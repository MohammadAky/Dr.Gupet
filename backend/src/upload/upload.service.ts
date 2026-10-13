import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createRequire } from 'module';
import { RedisService } from '../redis/redis.service';

// This project retains CommonJS/node resolution; Sharp exposes split ESM/CJS types.
const sharp: typeof import('sharp').default = createRequire(__filename)('sharp');

// Magic bytes for file type validation
const MAGIC_BYTES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  'image/webp': [
    Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF header
  ],
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const QUOTA_TTL_SECONDS = 48 * 3600; // keep the daily window + slack
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_EDGE = 1920;

@Injectable()
export class UploadService {
  private uploadDir: string;
  private maxMb: number;
  private publicBaseUrl: string;
  private dailyCountLimit: number;
  private dailyBytesLimit: number;
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private configService: ConfigService,
    private redis: RedisService,
  ) {
    this.uploadDir = this.configService.get<string>('app.uploadDir') || './uploads';
    this.maxMb = this.configService.get<number>('app.uploadMaxMb') || 5;
    this.publicBaseUrl =
      this.configService.get<string>('app.publicBaseUrl') || 'http://localhost:3000';
    this.dailyCountLimit = this.configService.get<number>('app.uploadDailyCountLimit') || 50;
    this.dailyBytesLimit =
      this.configService.get<number>('app.uploadDailyBytesLimit') || 50 * 1024 * 1024;

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private quotaKeys(userId: number): { countKey: string; bytesKey: string } {
    const day = new Date().toISOString().slice(0, 10);
    return {
      countKey: `upload:quota:${userId}:${day}:count`,
      bytesKey: `upload:quota:${userId}:${day}:bytes`,
    };
  }

  /**
   * Per-user daily quota (issue #07) — Redis counters for files and bytes.
   * Counters are incremented first and rolled back on rejection so concurrent
   * uploads cannot overshoot the limit.
   */
  private async consumeQuota(userId: number, size: number): Promise<void> {
    const { countKey, bytesKey } = this.quotaKeys(userId);

    const count = await this.redis.incr(countKey);
    if (count === 1) await this.redis.expire(countKey, QUOTA_TTL_SECONDS);
    if (count > this.dailyCountLimit) {
      await this.redis.incrBy(countKey, -1);
      throw new BadRequestException('تعداد آپلود روزانه شما تکمیل شده است');
    }

    const bytes = await this.redis.incrBy(bytesKey, size);
    if (bytes === size) await this.redis.expire(bytesKey, QUOTA_TTL_SECONDS);
    if (bytes > this.dailyBytesLimit) {
      await this.redis.incrBy(bytesKey, -size);
      await this.redis.incrBy(countKey, -1);
      throw new BadRequestException('حجم آپلود روزانه شما تکمیل شده است');
    }
  }

  /**
   * Upload image file with validation
   * Returns the public URL
   */
  async uploadImage(userId: number, file: Express.Multer.File): Promise<{ url: string }> {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('فایل ارسال نشده است');
    }

    // Validate file size
    const maxSize = this.maxMb * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(`حجم فایل نباید بیشتر از ${this.maxMb} مگابایت باشد`);
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('فقط فایل‌های JPEG، PNG و WebP مجاز هستند');
    }

    // Validate actual file type via magic bytes
    const actualMimeType = this.getMimeType(file.buffer);
    if (!actualMimeType || !ALLOWED_MIME_TYPES.includes(actualMimeType)) {
      throw new BadRequestException('نوع فایل معتبر نیست');
    }

    // Decode and normalize before consuming quota; a renamed file is not WebP.
    let image: Buffer;
    try {
      const decoder = sharp(file.buffer, {
        animated: true,
        limitInputPixels: MAX_IMAGE_PIXELS,
        failOn: 'error',
      });
      const metadata = await decoder.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) {
        throw new Error('Unsupported decoded format');
      }
      const pixels =
        (metadata.width ?? 0) *
        (metadata.pageHeight ?? metadata.height ?? 0) *
        (metadata.pages ?? 1);
      if (!pixels || pixels > MAX_IMAGE_PIXELS) throw new Error('Image exceeds pixel limit');
      // Rotation is only meaningful/supported for a single frame. Preserve animation.
      if ((metadata.pages ?? 1) === 1) decoder.rotate();
      image = await decoder
        .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .timeout({ seconds: 10 })
        .toBuffer();
      if (image.length > maxSize) throw new Error('Encoded image exceeds byte limit');
    } catch {
      throw new BadRequestException('تصویر معتبر نیست یا ابعاد آن بیش از حد مجاز است');
    }

    // Per-user daily quota (issue #07)
    await this.consumeQuota(userId, file.size);

    // Generate random filename
    const filename = `${crypto.randomUUID()}.webp`;
    const filepath = path.join(this.uploadDir, filename);

    // Write file — remove it again if the write fails halfway (issue #07).
    try {
      await fs.promises.writeFile(filepath, image, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        try {
          await fs.promises.unlink(filepath);
        } catch {
          /* nothing to clean up */
        }
      }
      this.logger.error(`upload write failed: ${(error as Error).message}`);
      throw new BadRequestException('ذخیره فایل ناموفق بود');
    }

    // Return public URL
    const url = `${this.publicBaseUrl}/uploads/${filename}`;
    return { url };
  }

  private getMimeType(buffer: Buffer): string | null {
    for (const [mimeType, magicBytes] of Object.entries(MAGIC_BYTES)) {
      for (const magic of magicBytes) {
        if (buffer.subarray(0, magic.length).equals(magic)) {
          return mimeType;
        }
      }
    }
    return null;
  }
}

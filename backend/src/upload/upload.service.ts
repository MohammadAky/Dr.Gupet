import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Magic bytes for file type validation
const MAGIC_BYTES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  'image/webp': [
    Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF header
  ],
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class UploadService {
  private uploadDir: string;
  private maxMb: number;
  private publicBaseUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('app.uploadDir') || './uploads';
    this.maxMb = this.configService.get<number>('app.uploadMaxMb') || 5;
    this.publicBaseUrl = this.configService.get<string>('app.publicBaseUrl') || 'http://localhost:3000';

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Upload image file with validation
   * Returns the public URL
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
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

    // Generate random filename
    const ext = this.getExtension(file.mimetype);
    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    // Write file
    fs.writeFileSync(filepath, file.buffer);

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

  private getExtension(mimetype: string): string {
    switch (mimetype) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return 'bin';
    }
  }
}
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

/**
 * Issue #24: parser limits are deliberately tiny — this API only accepts a
 * single `file` part. Exported so the contract can be asserted in a unit test.
 */
export function multerLimits(uploadMaxMb?: number) {
  const megabytes = Number.isFinite(uploadMaxMb) && (uploadMaxMb as number) > 0 ? (uploadMaxMb as number) : 5;
  return {
    fileSize: megabytes * 1024 * 1024,
    files: 1,
    fields: 1,
    parts: 2,
    fieldNameSize: 64,
    fieldSize: 256,
    headerPairs: 20,
  } as const;
}

@Module({
  imports: [
    // Issue #24: one file, one short field name, no extra parts. The parser
    // rejects resource-exhausting multipart before any handler runs, and the
    // body-size cap still comes from UPLOAD_MAX_MB (validated 1–10 at startup).
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: multerLimits(config.get<number>('app.uploadMaxMb')),
      }),
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

import { UploadService } from './upload.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Issue #07 — upload hardening: magic-byte validation, size limits from env,
 * per-user daily quota (count + bytes) with rollback, and no half-written files.
 */

function makeRedis(overrides: Record<string, unknown> = {}) {
  const store = new Map<string, number>();
  return {
    store,
    incr: jest.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    incrBy: jest.fn(async (key: string, amount: number) => {
      const next = (store.get(key) ?? 0) + amount;
      store.set(key, next);
      return next;
    }),
    expire: jest.fn(async () => true),
    ...overrides,
  };
}

function makeService(opts: { maxMb?: number; countLimit?: number; bytesLimit?: number; dir?: string } = {}) {
  const dir = opts.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'upl-'));
  const values: Record<string, unknown> = {
    'app.uploadDir': dir,
    'app.uploadMaxMb': opts.maxMb ?? 5,
    'app.uploadDailyCountLimit': opts.countLimit ?? 50,
    'app.uploadDailyBytesLimit': opts.bytesLimit ?? 50 * 1024 * 1024,
    'app.publicBaseUrl': 'http://api',
  };
  const config = { get: (key: string) => values[key] } as any;
  const redis = makeRedis();
  const service = new UploadService(config, redis as any);
  return { service, redis, dir };
}

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64)]);

function file(buffer: Buffer, mimetype = 'image/jpeg', size?: number) {
  return { buffer, mimetype, size: size ?? buffer.length, originalname: 'x.jpg' } as any;
}

describe('UploadService validation (issue #07)', () => {
  it('accepts JPEG/PNG/WebP by magic bytes and stores a random name', async () => {
    const { service, dir } = makeService();
    const res = await service.uploadImage(1, file(JPEG));
    expect(res.url).toMatch(/^http:\/\/api\/uploads\/[0-9a-f-]+\.jpg$/);
    const saved = fs.readdirSync(dir);
    expect(saved).toHaveLength(1);
    await expect(service.uploadImage(1, file(PNG, 'image/png'))).resolves.toBeTruthy();
  });

  it('rejects spoofed content types (magic bytes mismatch)', async () => {
    const { service } = makeService();
    await expect(
      service.uploadImage(1, file(Buffer.from('not-an-image'), 'image/jpeg')),
    ).rejects.toThrow('نوع فایل معتبر نیست');
  });

  it('rejects disallowed mimetypes and oversized files', async () => {
    const { service } = makeService({ maxMb: 1 });
    await expect(service.uploadImage(1, file(JPEG, 'image/gif'))).rejects.toThrow('JPEG');
    await expect(service.uploadImage(1, file(JPEG, 'image/jpeg', 2 * 1024 * 1024))).rejects.toThrow(
      'مگابایت',
    );
    await expect(service.uploadImage(1, undefined as any)).rejects.toThrow('ارسال نشده');
  });
});

describe('UploadService per-user daily quota (issue #07)', () => {
  it('caps the number of uploads per user per day and rolls back the counter', async () => {
    const { service, redis } = makeService({ countLimit: 2 });
    await service.uploadImage(9, file(JPEG));
    await service.uploadImage(9, file(JPEG));
    await expect(service.uploadImage(9, file(JPEG))).rejects.toThrow('تعداد آپلود روزانه');
    // rolled back — the rejected attempt must not consume quota
    const countKey = [...redis.store.keys()].find((k) => k.includes(':count'))!;
    expect(redis.store.get(countKey)).toBe(2);
  });

  it('caps the daily bytes and rolls back both counters on rejection', async () => {
    const { service, redis } = makeService({ bytesLimit: JPEG.length + 10 });
    await service.uploadImage(9, file(JPEG));
    await expect(service.uploadImage(9, file(JPEG))).rejects.toThrow('حجم آپلود روزانه');
    const countKey = [...redis.store.keys()].find((k) => k.includes(':count'))!;
    const bytesKey = [...redis.store.keys()].find((k) => k.includes(':bytes'))!;
    expect(redis.store.get(countKey)).toBe(1); // second attempt rolled back
    expect(redis.store.get(bytesKey)).toBe(JPEG.length);
  });

  it('tracks quota per user independently', async () => {
    const { service } = makeService({ countLimit: 1 });
    await service.uploadImage(1, file(JPEG));
    await expect(service.uploadImage(1, file(JPEG))).rejects.toThrow('تعداد آپلود');
    await expect(service.uploadImage(2, file(JPEG))).resolves.toBeTruthy();
  });
});

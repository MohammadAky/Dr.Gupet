import { UploadService } from './upload.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { createRequire } from 'module';
const sharp: typeof import('sharp').default = createRequire(__filename)('sharp');

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

function makeService(
  opts: { maxMb?: number; countLimit?: number; bytesLimit?: number; dir?: string } = {},
) {
  const dir = opts.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'upl-'));
  temporaryDirs.push(dir);
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

let JPEG: Buffer;
let PNG: Buffer;
let WEBP: Buffer;
const temporaryDirs: string[] = [];

beforeAll(async () => {
  const source = {
    create: {
      width: 24,
      height: 16,
      channels: 4 as const,
      background: { r: 21, g: 92, b: 32, alpha: 0.5 },
    },
  };
  [JPEG, PNG, WEBP] = await Promise.all([
    sharp(source).jpeg().toBuffer(),
    sharp(source).png().toBuffer(),
    sharp(source).webp().toBuffer(),
  ]);
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await Promise.all(
    temporaryDirs.map((dir) => {
      if (!path.resolve(dir).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) {
        throw new Error('Refusing cleanup outside the temporary test directory');
      }
      return fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }),
  );
});

function file(buffer: Buffer, mimetype = 'image/jpeg', size?: number) {
  return { buffer, mimetype, size: size ?? buffer.length, originalname: 'x.jpg' } as any;
}

describe('UploadService validation (issue #07)', () => {
  it('decodes JPEG/PNG/WebP and stores real WebP with random names and alpha preserved', async () => {
    const { service, dir } = makeService();
    for (const [input, mime] of [
      [JPEG, 'image/jpeg'],
      [PNG, 'image/png'],
      [WEBP, 'image/webp'],
    ] as const) {
      const res = await service.uploadImage(1, file(input, mime));
      expect(res.url).toMatch(/^http:\/\/api\/uploads\/[0-9a-f-]+\.webp$/);
      const saved = await fs.promises.readFile(path.join(dir, path.basename(res.url)));
      const metadata = await sharp(saved).metadata();
      expect(metadata).toMatchObject({ format: 'webp', width: 24, height: 16 });
      if (mime !== 'image/jpeg') expect(metadata.hasAlpha).toBe(true);
    }
    expect(fs.readdirSync(dir)).toHaveLength(3);
  });

  it('rejects truncated image data with valid magic bytes before quota or write', async () => {
    const { service, redis, dir } = makeService();
    await expect(service.uploadImage(1, file(JPEG.subarray(0, 12)))).rejects.toThrow(
      'تصویر معتبر نیست',
    );
    expect(redis.store.size).toBe(0);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('preserves animated WebP frames, timing and loop count', async () => {
    // Original two-frame 8x6 fixture: red/green at 100/200ms, looping twice.
    const animated = Buffer.from(
      'UklGRoQAAABXRUJQVlA4WAoAAAASAAAABwAABQAAQU5JTQYAAAAAAAAAAgBBTk1GKAAAAAAAAAAAAAcAAAUAAGQAAAJWUDhMDwAAAC8HQAEQBxD9jwIGIqL/AQBBTk1GKAAAAAAAAAAAAAcAAAUAAMgAAAJWUDhMDwAAAC8HQAEQB9D/iAIGIqL/AQA=',
      'base64',
    );
    const { service, dir } = makeService();
    const result = await service.uploadImage(1, file(animated, 'image/webp'));
    const saved = await fs.promises.readFile(path.join(dir, path.basename(result.url)));
    const metadata = await sharp(saved, { animated: true }).metadata();
    expect(metadata).toMatchObject({
      format: 'webp',
      pages: 2,
      pageHeight: 6,
      width: 8,
      loop: 2,
      delay: [100, 200],
    });
  });

  it('respects orientation, caps dimensions and strips metadata', async () => {
    const source = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: '#123412' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const { service, dir } = makeService();
    const result = await service.uploadImage(1, file(source));
    const saved = await fs.promises.readFile(path.join(dir, path.basename(result.url)));
    const metadata = await sharp(saved).metadata();
    expect(metadata).toMatchObject({ width: 960, height: 1920, format: 'webp' });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it('rejects images exceeding the decoded pixel cap before consuming quota', async () => {
    const huge = await sharp({
      create: { width: 6400, height: 6400, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    const { service, redis } = makeService();
    await expect(service.uploadImage(1, file(huge, 'image/png'))).rejects.toThrow('ابعاد');
    expect(redis.store.size).toBe(0);
  });

  it('removes a partial file after asynchronous write failure', async () => {
    const { service, dir } = makeService();
    const original = fs.promises.writeFile;
    jest.spyOn(fs.promises, 'writeFile').mockImplementation(async (...args) => {
      await original(...args);
      throw new Error('simulated write failure');
    });
    await expect(service.uploadImage(1, file(JPEG))).rejects.toThrow('ذخیره فایل ناموفق');
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('preserves an existing file if a random filename collides', async () => {
    const { service, dir } = makeService();
    const id = '00000000-0000-0000-0000-000000000001';
    const destination = path.join(dir, `${id}.webp`);
    await fs.promises.writeFile(destination, WEBP);
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    await expect(service.uploadImage(1, file(JPEG))).rejects.toThrow('ذخیره فایل ناموفق');
    expect(await fs.promises.readFile(destination)).toEqual(WEBP);
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

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '../../common/interceptors/transform-response.interceptor';
import { JwtStrategy } from '../../modules/auth/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsController } from '../settings/settings.controller';
import { SettingsService } from '../settings/settings.service';
import { AdminPopupController, PublicPopupController } from './popup.controller';
import { EMPTY_POPUP, POPUP_SETTING_KEY, PopupService } from './popup.service';

// Reuse the repository's CommonJS HTTP adapter without adding type dependencies.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const TEST_SECRET = 'isolated-popup-http-tests-only';
const activePopup = {
  enabled: true,
  title: 'خوش آمدید',
  body: 'برای انتخاب غذای مناسب، اطلاعات پت را کامل کنید.',
  image: '/brand/welcome.webp',
};
const adminPath = '/api/v1/admin/storefront/popup';
const publicPath = '/api/v1/storefront/popup';
type SettingRow = { key: string; value: string; updatedAt: Date };

/** Actual Nest HTTP/auth/validation with isolated Prisma rows, never a live DB/JWT acceptance test. */
describe('Storefront popup publication and administrator boundaries', () => {
  let app: INestApplication;
  let rows: Map<string, SettingRow>;
  const audit = { record: jest.fn() };
  const prisma = {
    setting: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const jwt = new JwtService();
  const token = (id: number, claimedRole = 'ADMIN') =>
    jwt.sign({ sub: id, role: claimedRole, sv: 0 }, { secret: TEST_SECRET, expiresIn: '2m' });
  const setStored = (value: unknown) => {
    rows.set(POPUP_SETTING_KEY, {
      key: POPUP_SETTING_KEY,
      value: JSON.stringify(value),
      updatedAt: new Date('2026-01-01'),
    });
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [PublicPopupController, AdminPopupController, SettingsController],
      providers: [
        PopupService,
        SettingsService,
        JwtStrategy,
        RolesGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: () => TEST_SECRET } },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor(module.get(Reflector)));
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    rows = new Map();
    prisma.setting.findUnique.mockImplementation(
      async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null,
    );
    prisma.setting.findMany.mockImplementation(
      async ({ where }: { where: { key: { not: string } } }) =>
        [...rows.values()].filter((row) => row.key !== where.key.not),
    );
    prisma.setting.upsert.mockImplementation(
      async (args: {
        where: { key: string };
        create: { key: string; value: string };
        update: { value: string };
      }) => {
        const row = {
          key: args.where.key,
          value: rows.has(args.where.key) ? args.update.value : args.create.value,
          updatedAt: new Date(),
        };
        rows.set(row.key, row);
        return row;
      },
    );
    prisma.user.findUnique.mockImplementation(
      async ({ where }: { where: { id: number; deletedAt: null } }) => {
        if (![1, 2].includes(where.id) || where.deletedAt !== null) return null;
        return {
          id: where.id,
          role: where.id === 1 ? 'ADMIN' : 'USER',
          status: 'ACTIVE',
          sessionVersion: 0,
        };
      },
    );
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns a disabled empty public contract when no setting exists', async () => {
    const response = await request(app.getHttpServer()).get(publicPath);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: EMPTY_POPUP });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.setting.findUnique).toHaveBeenCalledWith({ where: { key: POPUP_SETTING_KEY } });
  });

  it('hides disabled draft content publicly while allowing the administrator to reopen it', async () => {
    const draft = { ...activePopup, enabled: false };
    setStored(draft);
    const publicResponse = await request(app.getHttpServer()).get(publicPath);
    expect(publicResponse.body.data).toEqual(EMPTY_POPUP);
    expect(JSON.stringify(publicResponse.body)).not.toContain(draft.title);
    const adminResponse = await request(app.getHttpServer())
      .get(adminPath)
      .set('Authorization', `Bearer ${token(1)}`);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data).toEqual(draft);
  });

  it('publishes only safe popup fields and never exposes other operational settings', async () => {
    setStored({ ...activePopup, internalSecret: 'must-never-be-public' });
    rows.set('SHIPPING_FLAT_COST', {
      key: 'SHIPPING_FLAT_COST',
      value: '45000',
      updatedAt: new Date(),
    });
    const response = await request(app.getHttpServer()).get(publicPath);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: activePopup });
    expect(prisma.setting.findMany).not.toHaveBeenCalled();
  });

  it.each(['get', 'put'] as const)(
    'requires authentication for administrator %s',
    async (method) => {
      const response = await request(app.getHttpServer())[method](adminPath).send(activePopup);
      expect(response.status).toBe(401);
      expect(prisma.setting.findUnique).not.toHaveBeenCalled();
      expect(prisma.setting.upsert).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid bearer signature before touching popup storage', async () => {
    const forged = jwt.sign({ sub: 1, role: 'ADMIN' }, { secret: 'another-test-secret' });
    const response = await request(app.getHttpServer())
      .put(adminPath)
      .set('Authorization', `Bearer ${forged}`)
      .send(activePopup);
    expect(response.status).toBe(401);
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it.each(['get', 'put'] as const)(
    'rejects a customer for administrator %s even when the token claims ADMIN',
    async (method) => {
      const response = await request(app.getHttpServer())
        [method](adminPath)
        .set('Authorization', `Bearer ${token(2, 'ADMIN')}`)
        .send(activePopup);
      expect(response.status).toBe(403);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 2, deletedAt: null } }),
      );
      expect(prisma.setting.findUnique).not.toHaveBeenCalled();
      expect(prisma.setting.upsert).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    },
  );

  it('persists a complete administrator update, trims text and records the actual actor', async () => {
    const response = await request(app.getHttpServer())
      .put(adminPath)
      .set('Authorization', `Bearer ${token(1)}`)
      .send({ ...activePopup, title: `  ${activePopup.title}  `, body: `  ${activePopup.body}  ` });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(activePopup);
    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: POPUP_SETTING_KEY },
      create: { key: POPUP_SETTING_KEY, value: JSON.stringify(activePopup) },
      update: { value: JSON.stringify(activePopup) },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 1,
        action: 'UPDATE',
        entity: 'Setting',
        entityId: POPUP_SETTING_KEY,
        summary: 'Popup enabled',
        ip: expect.any(String),
      }),
    );
    const reopened = await request(app.getHttpServer())
      .get(adminPath)
      .set('Authorization', `Bearer ${token(1)}`);
    expect(reopened.body.data).toEqual(activePopup);
    const published = await request(app.getHttpServer()).get(publicPath);
    expect(published.body.data).toEqual(activePopup);
  });

  it('disables a previously enabled popup while preserving its draft for administrators', async () => {
    setStored(activePopup);
    const draft = { ...activePopup, enabled: false };
    const response = await request(app.getHttpServer())
      .put(adminPath)
      .set('Authorization', `Bearer ${token(1)}`)
      .send(draft);
    expect(response.status).toBe(200);
    expect(JSON.parse(rows.get(POPUP_SETTING_KEY)!.value)).toEqual(draft);
    expect((await request(app.getHttpServer()).get(publicPath)).body.data).toEqual(EMPTY_POPUP);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Popup disabled' }),
    );
  });

  it.each([
    ['image only', { enabled: true, title: '', body: '', image: '/uploads/banner.webp' }],
    ['title only', { enabled: true, title: 'تخفیف هفته', body: '', image: '' }],
    ['body only', { enabled: true, title: '', body: 'ارسال رایگان', image: '' }],
    ['mixed', activePopup],
  ])('publishes an enabled %s popup (issue #36)', async (_label, content) => {
    const response = await request(app.getHttpServer())
      .put(adminPath)
      .set('Authorization', `Bearer ${token(1)}`)
      .send(content);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(content);
    expect(JSON.parse(rows.get(POPUP_SETTING_KEY)!.value)).toEqual(content);
    const published = await request(app.getHttpServer()).get(publicPath);
    expect(published.body.data).toEqual(content);
  });

  it('refuses to enable a completely empty popup but keeps it as a draft', async () => {
    const empty = { enabled: true, title: '  ', body: '', image: '' };
    const response = await request(app.getHttpServer())
      .put(adminPath)
      .set('Authorization', `Bearer ${token(1)}`)
      .send(empty);
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('تصویر، عنوان یا متن');
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
    const draft = { ...empty, enabled: false };
    const draftResponse = await request(app.getHttpServer())
      .put(adminPath)
      .set('Authorization', `Bearer ${token(1)}`)
      .send(draft);
    expect(draftResponse.status).toBe(200);
    // Stored drafts keep the server's trimmed text; nothing else is invented.
    expect(draftResponse.body.data).toEqual({ enabled: false, title: '', body: '', image: '' });
  });

  it('accepts maximum supported text lengths and an empty optional image', async () => {
    const content = { enabled: true, title: 'ت'.repeat(90), body: 'م'.repeat(800), image: '' };
    const response = await request(app.getHttpServer())
      .put(adminPath)
      .set('Authorization', `Bearer ${token(1)}`)
      .send(content);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(content);
  });

  const invalidContent = [
    ['string flag', { ...activePopup, enabled: 'true' }],
    ['numeric title', { ...activePopup, title: 12 }],
    ['nonstring body', { ...activePopup, body: { text: 'hello' } }],
    ['null image', { ...activePopup, image: null }],
    ['long title', { ...activePopup, title: 'ت'.repeat(91) }],
    ['long body', { ...activePopup, body: 'م'.repeat(801) }],
    ['long image path', { ...activePopup, image: '/uploads/' + 'a'.repeat(500) + '.png' }],
    ['completely empty enabled popup', { enabled: true, title: ' \n\t ', body: ' \n\t ', image: '' }],
    ['extra field', { ...activePopup, userId: 8 }],
    ['partial body', { enabled: true, title: 'عنوان' }],
  ] as const;

  it.each(invalidContent)(
    'rejects %s without replacing existing persisted content',
    async (_label, content) => {
      setStored(activePopup);
      const response = await request(app.getHttpServer())
        .put(adminPath)
        .set('Authorization', `Bearer ${token(1)}`)
        .send(content);
      expect(response.status).toBe(400);
      expect(prisma.setting.upsert).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(JSON.parse(rows.get(POPUP_SETTING_KEY)!.value)).toEqual(activePopup);
    },
  );

  it.each([
    'https://remote.example/banner.png',
    '//remote.example/banner.png',
    'data:image/png;base64,AAAA',
    '/uploads/../private.png',
    '/uploads/%2e%2e/private.png',
    '/uploads/a\\b.png',
    '/brand/a.svg',
    '/uploads/file.svg.png?x=1',
    '/uploads/a.png#fragment',
    '/not-allowed/a.png',
  ])('rejects an unsafe image path %s at the HTTP boundary', async (image) => {
    const response = await request(app.getHttpServer())
      .put(adminPath)
      .set('Authorization', `Bearer ${token(1)}`)
      .send({ ...activePopup, image });
    expect(response.status).toBe(400);
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it.each([
    '/uploads/banner.png',
    '/uploads/nested/banner-1.jpg',
    '/brand/a_b.jpeg',
    '/brand/banner.webp',
  ])('accepts a supported same-site raster path %s', async (image) => {
    const response = await request(app.getHttpServer())
      .put(adminPath)
      .set('Authorization', `Bearer ${token(1)}`)
      .send({ ...activePopup, image });
    expect(response.status).toBe(200);
    expect(response.body.data.image).toBe(image);
  });

  it.each(
    [
      null,
      [],
      42,
      'not an object',
      {},
      { ...activePopup, enabled: 'true' },
      { enabled: true, title: '', body: '', image: '' },
      { ...activePopup, image: 'https://remote.example/x.png' },
      { ...activePopup, title: 'x'.repeat(91) },
      { ...activePopup, body: 'x'.repeat(801) },
    ].map((content) => [content] as const),
  )('fails closed for corrupt stored content %j', async (content) => {
    setStored(content);
    const publicResponse = await request(app.getHttpServer()).get(publicPath);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data).toEqual(EMPTY_POPUP);
    const adminResponse = await request(app.getHttpServer())
      .get(adminPath)
      .set('Authorization', `Bearer ${token(1)}`);
    expect(adminResponse.body.data).toEqual(EMPTY_POPUP);
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it('fails closed for invalid JSON without leaking raw setting values', async () => {
    rows.set(POPUP_SETTING_KEY, {
      key: POPUP_SETTING_KEY,
      value: '{invalid-private-draft',
      updatedAt: new Date(),
    });
    const response = await request(app.getHttpServer()).get(publicPath);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: EMPTY_POPUP });
  });

  it('keeps the popup content out of the numeric settings list', async () => {
    setStored(activePopup);
    rows.set('SHIPPING_FLAT_COST', {
      key: 'SHIPPING_FLAT_COST',
      value: '45000',
      updatedAt: new Date(),
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${token(1)}`);
    expect(response.status).toBe(200);
    expect(prisma.setting.findMany).toHaveBeenCalledWith({
      where: { key: { not: POPUP_SETTING_KEY } },
      orderBy: { key: 'asc' },
    });
    expect(response.body.data).toEqual([
      expect.objectContaining({ key: 'SHIPPING_FLAT_COST', value: '45000', overridable: true }),
    ]);
    expect(response.body.meta.total).toBe(1);
    expect(JSON.stringify(response.body)).not.toContain(POPUP_SETTING_KEY);
  });
});

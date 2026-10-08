import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { normalizePhone } from '../../common/utils/phone.util';
import { AuthService } from './auth.service';
import { OtpService } from './otp/otp.service';
import { AUTH_USER_SELECT, safeSessionUser } from './auth-user';
import { assertPassword, canonicalUsername, PASSWORD_BCRYPT_COST } from './password-policy';
import type {
  PasswordRegisterDto,
  PasswordCredentialDto,
  PasswordResetDto,
  PasswordForgotDto,
} from './dto/password.dto';

// Public dummy value: missing users still perform the same cost-12 comparison.
const DUMMY_HASH = '$2b$12$LH.wVnpH8zGGmcsAjg9btehYHTsng4Q3wogcWs9OEYQRRo4Jd0ll2';
const FAILURE_WINDOW_SECONDS = 15 * 60;
type PasswordAccountInput = Pick<
  PasswordRegisterDto,
  'username' | 'password' | 'phone' | 'firstName' | 'lastName'
>;

@Injectable()
export class PasswordService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private auth: AuthService,
    private otp: OtpService,
    private config: ConfigService,
  ) {}

  async register(data: PasswordRegisterDto) {
    const username = canonicalUsername(data.username);
    const phone = this.validPhone(data.phone);
    assertPassword(data.password);
    // Proof must be consumed before creating or attaching an account identity.
    await this.otp.verify(phone, data.code);
    const passwordHash = await bcrypt.hash(data.password, PASSWORD_BCRYPT_COST);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { phone }, select: AUTH_USER_SELECT });
        if (existing) {
          if (existing.passwordCredential) {
            throw new AppException(
              'CONFLICT',
              'این حساب قبلاً نام کاربری دارد؛ وارد شوید یا رمز را بازیابی کنید',
              409,
            );
          }
          if (existing.deletedAt || existing.status !== 'ACTIVE') {
            throw new AppException('USER_BLOCKED', 'حساب کاربری مسدود است', 403);
          }
          // An OTP-owned existing account keeps its role, profile and history.
          await tx.passwordCredential.create({
            data: { userId: existing.id, username, passwordHash },
          });
          const user = await tx.user.update({
            where: { id: existing.id, deletedAt: null, status: 'ACTIVE' },
            data: { isPhoneVerified: true, sessionVersion: { increment: 1 } },
            select: AUTH_USER_SELECT,
          });
          return { user, isNewUser: false };
        }
        const user = await tx.user.create({
          data: {
            phone,
            role: 'USER',
            isPhoneVerified: true,
            firstName: data.firstName,
            lastName: data.lastName,
            cart: { create: {} },
            passwordCredential: { create: { username, passwordHash } },
          },
          select: AUTH_USER_SELECT,
        });
        return { user, isNewUser: true };
      });
      return this.auth.issueSession(result.user, result.isNewUser);
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  /** Called only by the ADMIN-guarded controller, never by public registration. */
  async createAccount(data: PasswordAccountInput, role: 'USER' | 'ADMIN') {
    const username = canonicalUsername(data.username);
    const phone = this.validPhone(data.phone);
    assertPassword(data.password);
    if (!['USER', 'ADMIN'].includes(role)) {
      throw new AppException('VALIDATION_ERROR', 'نقش نامعتبر است', 400);
    }
    const passwordHash = await bcrypt.hash(data.password, PASSWORD_BCRYPT_COST);
    try {
      // The protected admin create flow creates a new identity; it never upserts
      // an existing phone owner. Existing-account provisioning uses its explicit id.
      return await this.prisma.user.create({
        data: {
          phone,
          role,
          firstName: data.firstName,
          lastName: data.lastName,
          cart: { create: {} },
          passwordCredential: { create: { username, passwordHash } },
        },
        select: AUTH_USER_SELECT,
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async login(usernameInput: string, password: string, ip: string) {
    const username = canonicalUsername(usernameInput);
    const budget = await this.attemptBudget(username, ip);
    const credential = await this.prisma.passwordCredential.findUnique({
      where: { username },
      include: { user: { select: AUTH_USER_SELECT } },
    });
    // Never let bcrypt's 72-byte truncation authenticate an overlong input.
    const inputValid = typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72;
    const matches = await bcrypt.compare(
      inputValid ? password : '',
      credential?.passwordHash ?? DUMMY_HASH,
    );
    if (
      !inputValid ||
      !credential ||
      !matches ||
      credential.user.deletedAt ||
      credential.user.status !== 'ACTIVE'
    ) {
      throw this.invalidCredentials();
    }
    await this.redis.del(budget);
    // Use the version read with the verified hash, so a concurrent reset cannot
    // turn an old-password comparison into a new, valid session.
    return this.auth.issueSession(credential.user);
  }

  async change(userId: number, currentPassword: string, newPassword: string, ip: string) {
    assertPassword(newPassword);
    await this.attemptBudget(`user:${userId}`, ip);
    const credential = await this.prisma.passwordCredential.findUnique({
      where: { userId },
      include: { user: { select: AUTH_USER_SELECT } },
    });
    const inputValid =
      typeof currentPassword === 'string' && Buffer.byteLength(currentPassword, 'utf8') <= 72;
    const matches = await bcrypt.compare(
      inputValid ? currentPassword : '',
      credential?.passwordHash ?? DUMMY_HASH,
    );
    if (
      !inputValid ||
      !credential ||
      !matches ||
      credential.user.deletedAt ||
      credential.user.status !== 'ACTIVE'
    )
      throw this.invalidCredentials();
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_BCRYPT_COST);
    const user = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.passwordCredential.updateMany({
        where: { userId, passwordHash: credential.passwordHash },
        data: { passwordHash },
      });
      if (changed.count !== 1) throw this.invalidCredentials();
      return tx.user.update({
        where: { id: userId, deletedAt: null, status: 'ACTIVE' },
        data: { sessionVersion: { increment: 1 } },
        select: AUTH_USER_SELECT,
      });
    });
    return this.auth.issueSession(user);
  }

  async forgotRequest(data: PasswordForgotDto) {
    const username = canonicalUsername(data.username);
    const phone = this.validPhone(data.phone);
    const window = {
      expiresIn: this.config.get<number>('otp.ttlSeconds') || 120,
      cooldownSeconds: this.config.get<number>('otp.resendCooldownSeconds') || 60,
    };
    const credential = await this.prisma.passwordCredential.findUnique({
      where: { username },
      select: { user: { select: { phone: true, status: true, deletedAt: true } } },
    });
    if (
      credential?.user.phone === phone &&
      credential.user.status === 'ACTIVE' &&
      !credential.user.deletedAt
    ) {
      // Return the same response without exposing provider latency or failures.
      // This is in-process dispatch, not a durable queue or a delivery guarantee.
      // AuthService/SmsService retain their internal failure and delivery logs.
      void this.auth.requestOtp(phone).catch(() => {});
    }
    return window;
  }

  async forgotReset(data: PasswordResetDto) {
    const username = canonicalUsername(data.username);
    const phone = this.validPhone(data.phone);
    assertPassword(data.newPassword);
    const credential = await this.prisma.passwordCredential.findUnique({
      where: { username },
      include: { user: { select: { id: true, phone: true, status: true, deletedAt: true } } },
    });
    const invalid = () =>
      new AppException('INVALID_RESET', 'اطلاعات یا کد بازیابی معتبر نیست', 400);
    if (
      !credential ||
      credential.user.phone !== phone ||
      credential.user.deletedAt ||
      credential.user.status !== 'ACTIVE'
    )
      throw invalid();
    try {
      await this.otp.verify(phone, data.code);
    } catch {
      throw invalid();
    }
    const passwordHash = await bcrypt.hash(data.newPassword, PASSWORD_BCRYPT_COST);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.passwordCredential.updateMany({
        where: { userId: credential.userId, username, passwordHash: credential.passwordHash },
        data: { passwordHash },
      });
      if (changed.count !== 1) throw invalid();
      await tx.user.update({
        where: { id: credential.userId, deletedAt: null, status: 'ACTIVE' },
        data: { sessionVersion: { increment: 1 }, isPhoneVerified: true },
        select: { id: true },
      });
    });
    return { ok: true as const };
  }

  async setAccount(userId: number, data: PasswordCredentialDto) {
    const username = canonicalUsername(data.username);
    assertPassword(data.password);
    const passwordHash = await bcrypt.hash(data.password, PASSWORD_BCRYPT_COST);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: userId, deletedAt: null },
          select: { id: true, status: true },
        });
        if (!target) throw new NotFoundException('کاربر یافت نشد');
        if (target.status !== 'ACTIVE') {
          throw new AppException('USER_BLOCKED', 'حساب کاربری مسدود است', 403);
        }
        await tx.passwordCredential.upsert({
          where: { userId },
          create: { userId, username, passwordHash },
          update: { username, passwordHash },
          select: { userId: true },
        });
        return tx.user.update({
          where: { id: userId, deletedAt: null, status: 'ACTIVE' },
          data: { sessionVersion: { increment: 1 } },
          select: AUTH_USER_SELECT,
        });
      });
      return this.adminAccountResponse(user);
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  adminAccountResponse(user: Awaited<ReturnType<PasswordService['createAccount']>>) {
    return {
      ...safeSessionUser(user),
      role: user.role,
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
    };
  }

  private invalidCredentials() {
    return new AppException('INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور نادرست است', 401);
  }

  private validPhone(value: string): string {
    const phone = normalizePhone(value);
    if (!phone) throw new AppException('VALIDATION_ERROR', 'شماره موبایل معتبر نیست', 400);
    return phone;
  }

  private async attemptBudget(username: string, ip: string): Promise<string> {
    const digest = (value: string) => createHash('sha256').update(value).digest('hex');
    const pairKey = `password:attempt:${digest(`${ip}|${username}`)}`;
    const ipKey = `password:ip:${digest(ip)}`;
    for (const [key, limit] of [
      [pairKey, 5],
      [ipKey, 30],
    ] as const) {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, FAILURE_WINDOW_SECONDS);
      if (count > limit) {
        throw new AppException(
          'AUTH_RATE_LIMITED',
          'تعداد تلاش‌ها زیاد است؛ چند دقیقه بعد دوباره تلاش کنید',
          429,
        );
      }
    }
    return pairKey;
  }

  private rethrowConflict(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002') {
        throw new AppException('CONFLICT', 'نام کاربری یا شماره موبایل قبلاً ثبت شده است', 409);
      }
      if (error.code === 'P2034') {
        throw new AppException(
          'CONFLICT',
          'اطلاعات حساب هم‌زمان تغییر کرده است؛ دوباره تلاش کنید',
          409,
        );
      }
    }
    throw error;
  }
}

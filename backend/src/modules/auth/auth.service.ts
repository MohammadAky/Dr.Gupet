import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SmsService } from '../../sms/sms.service';
import { OtpService } from './otp.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private sms: SmsService,
    private otpService: OtpService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Request OTP for phone number
   */
  async requestOtp(phone: string): Promise<{ expiresIn: number }> {
    const code = await this.otpService.generate(phone);
    await this.sms.sendOtp(phone, code);

    const ttl = this.configService.get<number>('otp.ttlSeconds') || 120;
    return { expiresIn: ttl };
  }

  /**
   * Verify OTP and login/register
   */
  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: any;
    isNewUser: boolean;
  }> {
    await this.otpService.verify(phone, code);

    // Upsert user
    let isNewUser = false;
    let user = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        isPhoneVerified: true,
      },
    });

    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          phone,
          isPhoneVerified: true,
          cart: { create: {} },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          role: true,
          status: true,
          isPhoneVerified: true,
        },
      });
    } else if (!user.isPhoneVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isPhoneVerified: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          role: true,
          status: true,
          isPhoneVerified: true,
        },
      });
    }

    // Check if blocked
    if (user.status === 'BLOCKED') {
      throw new AppException('USER_BLOCKED', 'حساب کاربری شما مسدود شده است', 403);
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.role);

    // Return user without sensitive fields
    const { status: _, role: __, isPhoneVerified: ___, ...safeUser } = user;

    return {
      ...tokens,
      user: safeUser,
      isNewUser,
    };
  }

  /**
   * Refresh access token
   */
  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const jti = payload.jti;
      const userId = payload.sub;

      // Check if refresh token exists in Redis
      const key = `refresh:${userId}:${jti}`;
      const exists = await this.redis.exists(key);

      if (!exists) {
        throw new UnauthorizedException();
      }

      // Delete old refresh token (rotation)
      await this.redis.del(key);

      // Load user
      const user = await this.prisma.user.findUnique({
        where: { id: userId, deletedAt: null },
        select: { id: true, role: true, status: true },
      });

      if (!user || user.status === 'BLOCKED') {
        throw new AppException('USER_BLOCKED', 'حساب کاربری شما مسدود شده است', 403);
      }

      // Generate new tokens
      return this.generateTokens(user.id, user.role);
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new UnauthorizedException();
    }
  }

  /**
   * Logout — delete refresh token
   */
  async logout(userId: number, refreshToken: string): Promise<{ ok: true }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const key = `refresh:${userId}:${payload.jti}`;
      await this.redis.del(key);

      return { ok: true };
    } catch {
      // Even if token is invalid, return ok
      return { ok: true };
    }
  }

  private async generateTokens(
    userId: number,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessTtl = this.configService.get<string>('jwt.accessTtl') || '15m';
    const refreshTtl = this.configService.get<string>('jwt.refreshTtl') || '30d';

    // Access token
    const accessToken = this.jwtService.sign(
      { sub: userId, role },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: accessTtl,
      },
    );

    // Refresh token
    const jti = crypto.randomUUID();
    const refreshToken = this.jwtService.sign(
      { sub: userId, jti },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshTtl,
      },
    );

    // Store refresh token in Redis
    const refreshTtlSeconds = this.parseDuration(refreshTtl);
    await this.redis.set(`refresh:${userId}:${jti}`, '1', refreshTtlSeconds);

    return { accessToken, refreshToken };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 60 * 60; // default 30 days

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 30 * 24 * 60 * 60;
    }
  }
}
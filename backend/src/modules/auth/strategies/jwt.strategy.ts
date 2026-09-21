import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppException } from '../../../common/filters/all-exceptions.filter';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: { sub: number; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.status === 'BLOCKED') {
      throw new AppException('USER_BLOCKED', 'حساب کاربری شما مسدود شده است', 403);
    }

    return { id: user.id, role: user.role };
  }
}
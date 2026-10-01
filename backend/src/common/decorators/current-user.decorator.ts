import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export interface JwtPayload {
  sub: number;
  role: string;
}

/**
 * Reads the authenticated user from the request.
 * The identity contract is `{ sub, role }` (JwtStrategy/JwtRefreshStrategy).
 * When a specific field is requested but missing, the request is rejected
 * BEFORE any service/query runs (prevents undefined userId filters from
 * dropping Prisma where-clauses).
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (data) {
      const value = user?.[data];
      if (value === undefined || value === null) {
        throw new UnauthorizedException('هویت کاربر در درخواست یافت نشد');
      }
      return value;
    }

    return user;
  },
);

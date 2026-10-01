import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser, JwtPayload } from './current-user.decorator';
import { JwtStrategy } from '../../modules/auth/strategies/jwt.strategy';

function getParamDecoratorFactory(decorator: (data?: unknown) => ParameterDecorator) {
  class TestDecorator {
    public handler(@decorator() _value: unknown) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestDecorator, 'handler');
  const key = Object.keys(args)[0];
  return args[key].factory;
}

function contextWith(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser decorator — single identity contract (issue #3)', () => {
  const factory = getParamDecoratorFactory(CurrentUser);

  it('returns the requested field from { sub, role }', () => {
    const user: JwtPayload = { sub: 7, role: 'USER' };
    expect(factory('sub', contextWith(user))).toBe(7);
    expect(factory('role', contextWith(user))).toBe('USER');
  });

  it('throws Unauthorized when the requested identity field is missing (before any query)', () => {
    // The broken pre-fix shape: strategy returned { id, role }
    expect(() => factory('sub', contextWith({ id: 7, role: 'USER' }))).toThrow(
      UnauthorizedException,
    );
    expect(() => factory('sub', contextWith(undefined))).toThrow(UnauthorizedException);
  });

  it('throws when sub is explicitly null', () => {
    expect(() => factory('sub', contextWith({ sub: null, role: 'USER' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns the whole payload when no field is requested', () => {
    const user: JwtPayload = { sub: 7, role: 'ADMIN' };
    expect(factory(undefined, contextWith(user))).toEqual(user);
  });
});

describe('JwtStrategy payload shape (issue #3)', () => {
  it('exposes exactly { sub, role } to request.user', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 42, role: 'USER', status: 'ACTIVE' }),
      },
    };
    const config = { get: () => 'test-secret' };
    const strategy = new JwtStrategy(config as any, prisma as any);

    const result = await strategy.validate({ sub: 42, role: 'USER' });

    expect(result).toEqual({ sub: 42, role: 'USER' });
    expect(Object.keys(result).sort()).toEqual(['role', 'sub']);
    expect((result as any).id).toBeUndefined();
  });
});

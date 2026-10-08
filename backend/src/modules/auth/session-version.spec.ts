import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

const user = {
  id: 7,
  role: 'ADMIN',
  status: 'ACTIVE',
  deletedAt: null,
  sessionVersion: 0,
  phone: '09121234567',
  firstName: null,
  lastName: null,
  avatar: null,
  isPhoneVerified: true,
  passwordCredential: { username: 'sara' },
};
const config = {
  get: (key: string) => (key.includes('Secret') ? 'test-session-secret' : undefined),
};

function harness(sv = 0, payloadVersion?: number) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ ...user, sessionVersion: sv }) },
  };
  const redis = { del: jest.fn().mockResolvedValue(1), set: jest.fn() };
  const jwt = {
    verify: jest.fn().mockReturnValue({
      sub: 7,
      jti: 'one-time-id',
      ...(payloadVersion === undefined ? {} : { sv: payloadVersion }),
    }),
    sign: jest.fn().mockReturnValue('signed-token'),
  };
  const auth = new AuthService(
    prisma as any,
    redis as any,
    {} as any,
    {} as any,
    jwt as any,
    config as any,
  );
  const strategy = new JwtStrategy(config as any, prisma as any);
  return { auth, strategy, prisma, redis, jwt };
}

describe('Password session revocation for both authentication methods', () => {
  it('accepts legacy OTP access and refresh tokens only while the DB version is zero', async () => {
    const h = harness();
    await expect(h.strategy.validate({ sub: 7, role: 'USER' })).resolves.toEqual({
      sub: 7,
      role: 'ADMIN',
    });
    await expect(h.auth.refreshTokens('old-refresh')).resolves.toEqual({
      accessToken: 'signed-token',
      refreshToken: 'signed-token',
    });
    expect(h.jwt.sign.mock.calls[0][0]).toMatchObject({ sv: 0 });
  });

  it.each([undefined, 0])(
    'rejects old access and refresh version %s after password reset',
    async (version) => {
      const h = harness(1, version);
      await expect(
        h.strategy.validate({
          sub: 7,
          role: 'ADMIN',
          ...(version === undefined ? {} : { sv: version }),
        }),
      ).rejects.toMatchObject({ status: 401 });
      await expect(h.auth.refreshTokens('old-refresh')).rejects.toMatchObject({ status: 401 });
      expect(h.jwt.sign).not.toHaveBeenCalled();
    },
  );

  it('accepts the new version but uses the current database role', async () => {
    const h = harness(3, 3);
    h.prisma.user.findUnique.mockResolvedValue({ ...user, role: 'USER', sessionVersion: 3 });
    await expect(h.strategy.validate({ sub: 7, role: 'ADMIN', sv: 3 })).resolves.toEqual({
      sub: 7,
      role: 'USER',
    });
    await h.auth.refreshTokens('new-refresh');
    expect(h.jwt.sign.mock.calls[0][0]).toMatchObject({ role: 'USER', sv: 3 });
  });

  it('issues both token versions and never returns hash, credential relation or session metadata', async () => {
    const h = harness();
    const result = await h.auth.issueSession({ ...user, passwordHash: 'should-not-escape' } as any);
    expect(h.jwt.sign.mock.calls[0][0]).toMatchObject({ sub: 7, role: 'ADMIN', sv: 0 });
    expect(h.jwt.sign.mock.calls[1][0]).toMatchObject({ sub: 7, sv: 0 });
    expect(result.user).toEqual({
      id: 7,
      firstName: null,
      lastName: null,
      phone: '09121234567',
      avatar: null,
      username: 'sara',
    });
    expect(JSON.stringify(result)).not.toMatch(
      /passwordHash|passwordCredential|sessionVersion|should-not-escape/,
    );
  });
});

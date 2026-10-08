import { PasswordService } from './password.service';
import { safeSessionUser } from './auth-user';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('stored-password-hash'),
  compare: jest.fn().mockResolvedValue(true),
}));

const password = 'a-safe-test-password';
const phone = '09121234567';
const user = {
  id: 7,
  firstName: 'سارا',
  lastName: null,
  phone,
  avatar: null,
  role: 'USER',
  status: 'ACTIVE',
  deletedAt: null,
  isPhoneVerified: true,
  sessionVersion: 0,
  passwordCredential: { username: 'sara' },
};
const register = { username: 'Sara', password, phone: '+989121234567', code: '123456' };

function harness() {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({ ...user, sessionVersion: 1 }),
    },
    passwordCredential: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
    fn(prisma),
  );
  const redis = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn(), del: jest.fn() };
  const auth = {
    issueSession: jest.fn(async (row, isNewUser = false) => ({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: safeSessionUser(row),
      isNewUser,
    })),
    requestOtp: jest.fn().mockResolvedValue({ expiresIn: 120, cooldownSeconds: 60 }),
  };
  const otp = { verify: jest.fn().mockResolvedValue(true) };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new PasswordService(
    prisma as any,
    redis as any,
    auth as any,
    otp as any,
    config as any,
  );
  return { service, prisma, redis, auth, otp };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(bcrypt.hash).mockResolvedValue('stored-password-hash' as never);
  jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
});

describe('OTP-owned password registration', () => {
  it('does not hash or write anything without actual OTP proof', async () => {
    const h = harness();
    h.otp.verify.mockRejectedValue(new Error('invalid OTP'));
    await expect(h.service.register(register)).rejects.toThrow('invalid OTP');
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.auth.issueSession).not.toHaveBeenCalled();
  });

  it('creates a verified normal customer, normalized phone and canonical username after proof', async () => {
    const h = harness();
    const result = await h.service.register({ ...register, role: 'ADMIN' } as any);
    expect(h.otp.verify).toHaveBeenCalledWith(phone, '123456');
    expect(h.otp.verify.mock.invocationCallOrder[0]).toBeLessThan(
      h.prisma.user.create.mock.invocationCallOrder[0],
    );
    expect(h.prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone,
          role: 'USER',
          isPhoneVerified: true,
          cart: { create: {} },
          passwordCredential: {
            create: { username: 'sara', passwordHash: 'stored-password-hash' },
          },
        }),
      }),
    );
    expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
    expect(result.isNewUser).toBe(true);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain(password);
  });

  it('adds the first credential to the OTP-owned account without changing role or profile', async () => {
    const h = harness();
    h.prisma.user.findUnique.mockResolvedValue({
      ...user,
      role: 'ADMIN',
      passwordCredential: null,
    });
    h.prisma.user.update.mockResolvedValue({ ...user, role: 'ADMIN', sessionVersion: 1 });
    const result = await h.service.register({ ...register, firstName: 'replacement' });
    expect(h.prisma.user.create).not.toHaveBeenCalled();
    expect(h.prisma.passwordCredential.create).toHaveBeenCalledWith({
      data: { userId: 7, username: 'sara', passwordHash: 'stored-password-hash' },
    });
    expect(h.prisma.user.update.mock.calls[0][0].data).toEqual({
      isPhoneVerified: true,
      sessionVersion: { increment: 1 },
    });
    expect(result.isNewUser).toBe(false);
    expect(h.auth.issueSession.mock.calls[0][0].role).toBe('ADMIN');
  });

  it('never overwrites an existing phone account credential through registration', async () => {
    const h = harness();
    h.prisma.user.findUnique.mockResolvedValue(user);
    await expect(h.service.register(register)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.prisma.passwordCredential.create).not.toHaveBeenCalled();
    expect(h.prisma.user.update).not.toHaveBeenCalled();
  });

  it('reports a duplicate username safely without issuing a session', async () => {
    const h = harness();
    h.prisma.user.create.mockRejectedValue({ code: 'P2002' });
    await expect(h.service.register(register)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.auth.issueSession).not.toHaveBeenCalled();
  });
});

describe('Password login and attempt limits', () => {
  it('issues the same account session with the version read with the verified hash', async () => {
    const h = harness();
    const snapshot = { ...user, sessionVersion: 3 };
    h.prisma.passwordCredential.findUnique.mockResolvedValue({
      userId: 7,
      passwordHash: 'old-hash',
      user: snapshot,
    });
    await h.service.login(' SARA ', password, '127.0.0.1');
    expect(h.prisma.passwordCredential.findUnique.mock.calls[0][0].where).toEqual({
      username: 'sara',
    });
    expect(h.auth.issueSession).toHaveBeenCalledWith(snapshot);
    expect(h.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(['missing', 'wrong', 'blocked', 'deleted'])(
    'returns the same error for %s credentials',
    async (reason) => {
      const h = harness();
      h.prisma.passwordCredential.findUnique.mockResolvedValue(
        reason === 'missing'
          ? null
          : {
              userId: 7,
              passwordHash: 'real-hash',
              user: {
                ...user,
                status: reason === 'blocked' ? 'BLOCKED' : 'ACTIVE',
                deletedAt: reason === 'deleted' ? new Date() : null,
              },
            },
      );
      jest.mocked(bcrypt.compare).mockResolvedValue((reason !== 'wrong') as never);
      await expect(h.service.login('sara', password, '127.0.0.1')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'نام کاربری یا رمز عبور نادرست است',
      });
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(h.auth.issueSession).not.toHaveBeenCalled();
    },
  );

  it('rejects more than 72 UTF-8 bytes even if bcrypt would match a truncated password', async () => {
    const h = harness();
    h.prisma.passwordCredential.findUnique.mockResolvedValue({
      userId: 7,
      passwordHash: 'hash',
      user,
    });
    await expect(h.service.login('sara', 'ژ'.repeat(40), '127.0.0.1')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(h.auth.issueSession).not.toHaveBeenCalled();
  });

  it('blocks the sixth pair attempt before another hash comparison or database lookup', async () => {
    const h = harness();
    h.redis.incr.mockResolvedValue(6);
    await expect(h.service.login('sara', password, '127.0.0.1')).rejects.toMatchObject({
      code: 'AUTH_RATE_LIMITED',
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(h.prisma.passwordCredential.findUnique).not.toHaveBeenCalled();
  });
});

describe('Credential changes and recovery', () => {
  it('changes only after current-password verification and rotates the session version', async () => {
    const h = harness();
    h.prisma.passwordCredential.findUnique.mockResolvedValue({
      userId: 7,
      passwordHash: 'old-hash',
      user,
    });
    await h.service.change(7, password, 'a-new-safe-test-password', '127.0.0.1');
    expect(h.prisma.passwordCredential.updateMany).toHaveBeenCalledWith({
      where: { userId: 7, passwordHash: 'old-hash' },
      data: { passwordHash: 'stored-password-hash' },
    });
    expect(h.prisma.user.update.mock.calls[0][0].data).toEqual({
      sessionVersion: { increment: 1 },
    });
    expect(h.auth.issueSession.mock.calls[0][0].sessionVersion).toBe(1);
  });

  it('does not change a password with an incorrect current password', async () => {
    const h = harness();
    h.prisma.passwordCredential.findUnique.mockResolvedValue({
      userId: 7,
      passwordHash: 'hash',
      user,
    });
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
    await expect(
      h.service.change(7, 'wrong-password', password, '127.0.0.1'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not overwrite a credential changed concurrently', async () => {
    const h = harness();
    h.prisma.passwordCredential.findUnique.mockResolvedValue({
      userId: 7,
      passwordHash: 'old-hash',
      user,
    });
    h.prisma.passwordCredential.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      h.service.change(7, password, 'a-new-safe-test-password', '127.0.0.1'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(h.prisma.user.update).not.toHaveBeenCalled();
    expect(h.auth.issueSession).not.toHaveBeenCalled();
  });

  it.each(['missing', 'mismatch', 'blocked', 'delivery-failed', 'matched'])(
    'returns the same recovery request response for %s',
    async (reason) => {
      const h = harness();
      h.prisma.passwordCredential.findUnique.mockResolvedValue(
        reason === 'missing'
          ? null
          : {
              user: {
                ...user,
                phone: reason === 'mismatch' ? '09129876543' : phone,
                status: reason === 'blocked' ? 'BLOCKED' : 'ACTIVE',
              },
            },
      );
      if (reason === 'delivery-failed')
        h.auth.requestOtp.mockRejectedValue(new Error('provider failure'));
      await expect(h.service.forgotRequest({ username: 'sara', phone })).resolves.toEqual({
        expiresIn: 120,
        cooldownSeconds: 60,
      });
      expect(h.auth.requestOtp).toHaveBeenCalledTimes(
        ['matched', 'delivery-failed'].includes(reason) ? 1 : 0,
      );
    },
  );

  it('does not consume another phone owner’s OTP when username and phone do not match', async () => {
    const h = harness();
    h.prisma.passwordCredential.findUnique.mockResolvedValue({
      userId: 7,
      passwordHash: 'old-hash',
      user,
    });
    await expect(
      h.service.forgotReset({
        username: 'sara',
        phone: '09129876543',
        code: '123456',
        newPassword: password,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESET' });
    expect(h.otp.verify).not.toHaveBeenCalled();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not wait for provider delivery and handles a later send rejection', async () => {
    const h = harness();
    h.prisma.passwordCredential.findUnique.mockResolvedValue({ user });
    let rejectSend!: (error: Error) => void;
    h.auth.requestOtp.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectSend = reject;
      }),
    );
    await expect(h.service.forgotRequest({ username: 'sara', phone })).resolves.toEqual({
      expiresIn: 120,
      cooldownSeconds: 60,
    });
    rejectSend(new Error('late provider failure'));
    await Promise.resolve();
    expect(h.auth.requestOtp).toHaveBeenCalledWith(phone);
  });

  it('consumes valid ownership proof and atomically replaces the hash and revokes sessions', async () => {
    const h = harness();
    h.prisma.passwordCredential.findUnique.mockResolvedValue({
      userId: 7,
      username: 'sara',
      passwordHash: 'old-hash',
      user,
    });
    await expect(
      h.service.forgotReset({ username: 'sara', phone, code: '123456', newPassword: password }),
    ).resolves.toEqual({ ok: true });
    expect(h.otp.verify).toHaveBeenCalledWith(phone, '123456');
    expect(h.prisma.passwordCredential.updateMany.mock.calls[0][0].where).toEqual({
      userId: 7,
      username: 'sara',
      passwordHash: 'old-hash',
    });
    expect(h.prisma.user.update.mock.calls[0][0].data.sessionVersion).toEqual({ increment: 1 });
    expect(h.auth.issueSession).not.toHaveBeenCalled();
  });

  it('requires valid OTP proof for recovery and keeps invalid-code errors generic', async () => {
    const h = harness();
    h.prisma.passwordCredential.findUnique.mockResolvedValue({
      userId: 7,
      passwordHash: 'hash',
      user,
    });
    h.otp.verify.mockRejectedValue(new Error('bad code'));
    await expect(
      h.service.forgotReset({ username: 'sara', phone, code: '000000', newPassword: password }),
    ).rejects.toMatchObject({ code: 'INVALID_RESET' });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('admin provisioning targets only the explicit id, preserves phone and never returns a hash', async () => {
    const h = harness();
    h.prisma.user.findUnique.mockResolvedValue(user);
    const result = await h.service.setAccount(7, { username: 'Sara', password });
    expect(h.prisma.passwordCredential.upsert.mock.calls[0][0].where).toEqual({ userId: 7 });
    expect(h.prisma.user.update.mock.calls[0][0].data).toEqual({
      sessionVersion: { increment: 1 },
    });
    expect(result.phone).toBe(phone);
    expect(result.username).toBe('sara');
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|stored-password-hash/);
  });

  it('returns a retryable conflict for a concurrent administrator credential update', async () => {
    const h = harness();
    h.prisma.$transaction.mockRejectedValue({ code: 'P2034', message: 'private database details' });
    await expect(h.service.setAccount(7, { username: 'sara', password })).rejects.toMatchObject({
      code: 'CONFLICT',
      response: {
        code: 'CONFLICT',
        statusCode: 409,
        message: 'اطلاعات حساب هم‌زمان تغییر کرده است؛ دوباره تلاش کنید',
      },
    });
    expect(h.auth.issueSession).not.toHaveBeenCalled();
  });
});

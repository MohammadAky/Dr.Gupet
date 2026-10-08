import { ValidationPipe } from '@nestjs/common';
import {
  AdminPasswordRegisterDto,
  PasswordChangeDto,
  PasswordCredentialDto,
  PasswordForgotDto,
  PasswordLoginDto,
  PasswordRegisterDto,
  PasswordResetDto,
} from './password.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const registration = {
  username: ' Sara_1 ',
  password: 'a-safe-test-password',
  phone: '+989121234567',
  code: '123456',
};
const validate = (metatype: any, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

describe('Password API validation and identity boundaries', () => {
  it('normalizes the username and phone while preserving the password exactly', async () => {
    const password = '  A-safe-PASSword  ';
    await expect(
      validate(PasswordRegisterDto, { ...registration, password }),
    ).resolves.toMatchObject({
      username: 'sara_1',
      phone: '09121234567',
      password,
    });
  });

  it.each(['role', 'userId', 'isPhoneVerified', 'passwordHash', 'sessionVersion'])(
    'rejects public signup injection of %s',
    async (key) => {
      await expect(
        validate(PasswordRegisterDto, { ...registration, [key]: 'ADMIN' }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each(['phone', 'code'])('requires %s for password signup', async (key) => {
    const body: Record<string, unknown> = { ...registration };
    delete body[key];
    await expect(validate(PasswordRegisterDto, body)).rejects.toMatchObject({ status: 400 });
  });

  it.each(['ab', 'اسم', 'name@host', 'x'.repeat(33)])(
    'rejects an invalid username %s',
    async (username) => {
      await expect(
        validate(PasswordLoginDto, { username, password: 'wrong' }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each(['short', 'ژ'.repeat(37), 'a'.repeat(73), 'safe-password\0with-nul'])(
    'rejects a password outside the supported policy',
    async (password) => {
      await expect(
        validate(PasswordRegisterDto, { ...registration, password }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it('accepts exactly 72 UTF-8 bytes and at least 12 Unicode characters', async () => {
    await expect(
      validate(PasswordRegisterDto, { ...registration, password: 'ژ'.repeat(36) }),
    ).resolves.toBeDefined();
    await expect(
      validate(PasswordRegisterDto, { ...registration, password: '🙂'.repeat(12) }),
    ).resolves.toBeDefined();
  });

  it('requires a unique real phone and whitelisted role for protected admin creation', async () => {
    await expect(
      validate(AdminPasswordRegisterDto, {
        username: 'admin2',
        password: registration.password,
        role: 'ADMIN',
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate(AdminPasswordRegisterDto, { ...registration, role: 'SUPERADMIN' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate(AdminPasswordRegisterDto, {
        username: 'admin2',
        password: registration.password,
        phone: '09121234567',
        role: 'ADMIN',
      }),
    ).resolves.toMatchObject({ role: 'ADMIN' });
  });

  it('existing-account provisioning cannot change phone or role', async () => {
    await expect(
      validate(PasswordCredentialDto, {
        username: 'sara',
        password: registration.password,
        phone: '09129876543',
        role: 'ADMIN',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('requires both username and phone for recovery and code only for reset', async () => {
    await expect(validate(PasswordForgotDto, { username: 'sara' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      validate(PasswordResetDto, {
        username: 'sara',
        phone: registration.phone,
        newPassword: registration.password,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate(PasswordResetDto, {
        username: 'Sara',
        phone: registration.phone,
        code: '123456',
        newPassword: registration.password,
      }),
    ).resolves.toMatchObject({ username: 'sara', phone: '09121234567' });
  });

  it('change-password input cannot select another user or authority', async () => {
    await expect(
      validate(PasswordChangeDto, {
        currentPassword: registration.password,
        newPassword: registration.password,
        userId: 9,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

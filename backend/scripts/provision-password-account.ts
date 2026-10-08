/**
 * Explicit operator command; never part of seed, startup or deployment.
 * Supply DATABASE_URL and PASSWORD_ACCOUNT_USER_ID / _USERNAME / _PASSWORD in
 * a private process environment. Existing credentials require _REPLACE=true.
 * To create a missing designated administrator instead, explicitly set
 * PASSWORD_ACCOUNT_CREATE=true and PASSWORD_ACCOUNT_PHONE (omit _USER_ID).
 * Passwords must never be supplied as command arguments or printed.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { normalizePhone } from '../src/common/utils/phone.util';
import {
  assertPassword,
  canonicalUsername,
  PASSWORD_BCRYPT_COST,
} from '../src/modules/auth/password-policy';

async function main() {
  const id = Number(process.env.PASSWORD_ACCOUNT_USER_ID);
  const username = canonicalUsername(process.env.PASSWORD_ACCOUNT_USERNAME ?? '');
  const password = process.env.PASSWORD_ACCOUNT_PASSWORD ?? '';
  const replace = process.env.PASSWORD_ACCOUNT_REPLACE === 'true';
  const create = process.env.PASSWORD_ACCOUNT_CREATE === 'true';
  const phoneInput = process.env.PASSWORD_ACCOUNT_PHONE;
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  if (
    !process.env.DATABASE_URL ||
    (create
      ? Boolean(process.env.PASSWORD_ACCOUNT_USER_ID) || !phone
      : !Number.isSafeInteger(id) || id <= 0)
  ) {
    throw new Error('Private database configuration and an explicit user id are required');
  }
  assertPassword(password);
  const passwordHash = await bcrypt.hash(password, PASSWORD_BCRYPT_COST);
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      if (create) {
        // Explicit operator-only bootstrap. Unique phone/username constraints
        // reject duplicates; never attach to or overwrite another phone owner.
        const created = await tx.user.create({
          data: {
            phone: phone!,
            role: 'ADMIN',
            cart: { create: {} },
            passwordCredential: { create: { username, passwordHash } },
          },
          select: { id: true },
        });
        await tx.adminAuditLog.create({
          data: {
            adminId: created.id,
            action: 'CREATE',
            entity: 'User',
            entityId: String(created.id),
            summary: 'explicit operator administrator bootstrap',
          },
        });
        return;
      }
      const user = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          role: true,
          status: true,
          deletedAt: true,
          phone: true,
          passwordCredential: { select: { username: true } },
        },
      });
      if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE' || user.deletedAt) {
        throw new Error('Target must be an existing active administrator');
      }
      if (phoneInput && (!phone || user.phone !== phone)) {
        throw new Error('The explicit phone does not match the target administrator');
      }
      if (user.passwordCredential && !replace) {
        throw new Error('Credentials already exist; explicit replacement is required');
      }
      if (replace) {
        await tx.passwordCredential.upsert({
          where: { userId: id },
          create: { userId: id, username, passwordHash },
          update: { username, passwordHash },
          select: { userId: true },
        });
      } else {
        // A concurrent provision must not bypass explicit replacement consent.
        await tx.passwordCredential.create({
          data: { userId: id, username, passwordHash },
          select: { userId: true },
        });
      }
      await tx.user.update({
        where: { id, role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
        data: { sessionVersion: { increment: 1 } },
        select: { id: true },
      });
      await tx.adminAuditLog.create({
        data: {
          adminId: id,
          action: 'UPDATE',
          entity: 'User',
          entityId: String(id),
          summary: 'operator password provisioning; sessions revoked',
        },
      });
    });
    process.stdout.write('Administrator credentials provisioned.\n');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  // Prisma diagnostics may contain private connection/argument data.
  process.stderr.write(
    'Provisioning failed. Check private settings, target administrator and replacement permission.\n',
  );
  process.exitCode = 1;
});

import type { Prisma } from '@prisma/client';

/** Credential hashes are never part of an account/session response projection. */
export const AUTH_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  role: true,
  status: true,
  isPhoneVerified: true,
  deletedAt: true,
  sessionVersion: true,
  passwordCredential: { select: { username: true } },
} as const;

export type AuthUser = Prisma.UserGetPayload<{ select: typeof AUTH_USER_SELECT }>;

export function safeSessionUser(user: AuthUser) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatar: user.avatar,
    username: user.passwordCredential?.username ?? null,
  };
}

export function withUsername<T extends { passwordCredential?: { username: string } | null }>(
  user: T,
) {
  const { passwordCredential, ...safeUser } = user;
  return { ...safeUser, username: passwordCredential?.username ?? null };
}

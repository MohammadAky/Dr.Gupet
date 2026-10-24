import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { PRESENTATION_PREFIX } from '../../common/utils/presentation-sample.util';
import { CartService } from './cart.service';
import { GuestTransferDto } from './dto/guest-transfer.dto';

type RowOutcome = {
  variantId: number;
  quantity: number;
  previousQuantity: number | null;
  status: 'ADDED' | 'REPLACED' | 'UNCHANGED';
};

type StoredResult = { rows: RowOutcome[]; cartVersion: string };

/**
 * Issue #38 — atomic, idempotent handoff of the pre-login (guest) cart.
 *
 * Contract:
 *  - the owner comes from the session, never the body;
 *  - only (variantId, quantity) is trusted; stock/price/availability are read
 *    again on the server;
 *  - overlap policy is `replace`: the guest quantity wins for shared variants
 *    and every other account item is preserved;
 *  - one transaction holds a `FOR UPDATE` lock on the user's cart row, and the
 *    unique (userId, requestId) record makes retries after a dropped response
 *    return the same outcome instead of doubling quantities;
 *  - the same requestId with a different payload is a 409, and the record is
 *    scoped to the user so an id from another account cannot be replayed.
 */
@Injectable()
export class GuestTransferService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
  ) {}

  static payloadHash(rows: Array<{ variantId: number; quantity: number }>): string {
    const canonical = [...rows]
      .sort((a, b) => a.variantId - b.variantId)
      .map((row) => [row.variantId, row.quantity]);
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  async transfer(userId: number, dto: GuestTransferDto) {
    const seen = new Set<number>();
    for (const row of dto.rows) {
      if (seen.has(row.variantId)) {
        throw new AppException(
          'VALIDATION_ERROR',
          'هر گونهٔ محصول فقط یک بار در درخواست می‌تواند بیاید',
          400,
          [{ variantId: row.variantId, reason: 'DUPLICATE_VARIANT' }],
        );
      }
      seen.add(row.variantId);
    }

    const payloadHash = GuestTransferService.payloadHash(dto.rows);

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Serialize every transfer of this account, including a retry of the same
      // requestId, before reading the idempotency record.
      // INSERT IGNORE semantics: a concurrent first transfer cannot make one of
      // the two transactions fail on the unique userId.
      await tx.cart.createMany({ data: [{ userId }], skipDuplicates: true });
      await tx.$queryRaw(Prisma.sql`SELECT id FROM Cart WHERE userId = ${userId} FOR UPDATE`);

      const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true, updatedAt: true } });
      if (!cart) throw new AppException('CART_NOT_FOUND', 'سبد خرید یافت نشد', 404);

      if (dto.expectedCartVersion && dto.expectedCartVersion !== cart.updatedAt.toISOString()) {
        throw new AppException(
          'CART_VERSION_CONFLICT',
          'سبد خرید از دستگاه دیگری تغییر کرده است؛ فهرست را دوباره بخوانید',
          409,
          [{ currentVersion: cart.updatedAt.toISOString() }],
        );
      }

      const prior = await tx.guestTransfer.findUnique({
        where: { userId_requestId: { userId, requestId: dto.requestId } },
      });
      if (prior) {
        if (prior.payloadHash !== payloadHash) {
          throw new AppException(
            'GUEST_TRANSFER_CONFLICT',
            'این شناسهٔ درخواست قبلاً با محتوای دیگری استفاده شده است',
            409,
          );
        }
        return { stored: JSON.parse(prior.result) as StoredResult, replayed: true };
      }

      const variants = await tx.productVariant.findMany({
        where: { id: { in: dto.rows.map((row) => row.variantId) } },
        select: {
          id: true,
          stock: true,
          isActive: true,
          product: { select: { isActive: true, slug: true } },
        },
      });
      const byId = new Map(variants.map((variant) => [variant.id, variant]));

      const problems: Array<{ variantId: number; reason: string }> = [];
      for (const row of dto.rows) {
        const variant = byId.get(row.variantId);
        if (!variant) problems.push({ variantId: row.variantId, reason: 'VARIANT_NOT_FOUND' });
        else if (!variant.isActive || !variant.product.isActive)
          problems.push({ variantId: row.variantId, reason: 'VARIANT_UNAVAILABLE' });
        else if (variant.product.slug.startsWith(PRESENTATION_PREFIX))
          problems.push({ variantId: row.variantId, reason: 'PRESENTATION_ONLY' });
        else if (variant.stock < row.quantity)
          problems.push({ variantId: row.variantId, reason: 'OUT_OF_STOCK' });
      }
      if (problems.length > 0) {
        throw new AppException(
          'CART_ROW_REJECTED',
          'برخی اقلام سبد مهمان قابل انتقال نیستند',
          409,
          problems,
        );
      }

      const existing = await tx.cartItem.findMany({
        where: { cartId: cart.id },
        select: { id: true, variantId: true, quantity: true },
      });
      const existingByVariant = new Map(existing.map((item) => [item.variantId, item]));

      const rows: RowOutcome[] = [];
      for (const row of dto.rows) {
        const current = existingByVariant.get(row.variantId);
        if (!current) {
          await tx.cartItem.create({
            data: { cartId: cart.id, variantId: row.variantId, quantity: row.quantity },
          });
          rows.push({ ...row, previousQuantity: null, status: 'ADDED' });
          continue;
        }
        if (current.quantity === row.quantity) {
          rows.push({ ...row, previousQuantity: current.quantity, status: 'UNCHANGED' });
          continue;
        }
        // Overlap policy `replace`: the guest selection is the latest intent.
        await tx.cartItem.update({
          where: { id: current.id },
          data: { quantity: row.quantity },
        });
        rows.push({ ...row, previousQuantity: current.quantity, status: 'REPLACED' });
      }

      const after = await tx.cart.findUnique({ where: { userId }, select: { updatedAt: true } });
      const stored: StoredResult = {
        rows,
        cartVersion: (after?.updatedAt ?? new Date()).toISOString(),
      };
      await tx.guestTransfer.create({
        data: { userId, requestId: dto.requestId, payloadHash, result: JSON.stringify(stored) },
      });
      return { stored, replayed: false };
    });

    // The cart view is rebuilt from the database on every call (also on replay),
    // so prices and availability in the response are never a stored snapshot.
    const cart = await this.cartService.getCart(userId);
    const version = await this.prisma.cart.findUnique({
      where: { userId },
      select: { updatedAt: true },
    });

    return {
      replayed: outcome.replayed,
      rows: outcome.stored.rows,
      cartVersion: (version?.updatedAt ?? new Date()).toISOString(),
      cart,
    };
  }
}

import { GuestTransferService } from './guest-transfer.service';
import { CartService } from './cart.service';

type Variant = {
  id: number;
  stock: number;
  isActive: boolean;
  product: { isActive: boolean; slug: string };
};

const VARIANTS: Variant[] = [
  { id: 1, stock: 10, isActive: true, product: { isActive: true, slug: 'dog-food' } },
  { id: 2, stock: 5, isActive: true, product: { isActive: true, slug: 'cat-food' } },
  { id: 3, stock: 0, isActive: true, product: { isActive: true, slug: 'empty' } },
  { id: 4, stock: 10, isActive: false, product: { isActive: true, slug: 'inactive' } },
  { id: 5, stock: 10, isActive: true, product: { isActive: true, slug: 'presentation-v1-x' } },
];

function harness(options: {
  items?: Array<{ id: number; variantId: number; quantity: number }>;
  version?: Date;
  transfers?: Array<{ userId: number; requestId: string; payloadHash: string; result: string }>;
} = {}) {
  const version = options.version ?? new Date('2026-10-20T10:00:00.000Z');
  const cart = { id: 50, userId: 7, updatedAt: version };
  const items = [...(options.items ?? [])];
  const transfers = [...(options.transfers ?? [])];
  let nextItemId = 100;

  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: cart.id }]),
    cart: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(async () => ({ id: cart.id, updatedAt: cart.updatedAt })),
    },
    productVariant: {
      findMany: jest.fn(async ({ where }: any) => VARIANTS.filter((v) => where.id.in.includes(v.id))),
    },
    cartItem: {
      findMany: jest.fn(async () => items.map((item) => ({ ...item }))),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: ++nextItemId, ...data };
        items.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = items.find((item) => item.id === where.id)!;
        row.quantity = data.quantity;
        return row;
      }),
    },
    guestTransfer: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.userId_requestId;
        return (
          transfers.find((row) => row.userId === key.userId && row.requestId === key.requestId) ??
          null
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        transfers.push(data);
        return data;
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    cart: { findUnique: jest.fn(async () => ({ updatedAt: cart.updatedAt })) },
  };

  const cartService = {
    getCart: jest.fn(async () => ({ items: items.map((item) => ({ ...item })), itemsTotal: 0 })),
  } as unknown as CartService;

  const service = new GuestTransferService(prisma as any, cartService);
  return { service, tx, prisma, items, transfers, cart, cartService };
}

const base = {
  requestId: 'req-abcdefghijklmnop',
  rows: [{ variantId: 1, quantity: 2 }],
};

describe('guest cart handoff (issue #38)', () => {
  it('adds guest rows and preserves account-only rows', async () => {
    const h = harness({ items: [{ id: 1, variantId: 2, quantity: 1 }] });
    const result = await h.service.transfer(7, base);
    expect(result.rows).toEqual([
      { variantId: 1, quantity: 2, previousQuantity: null, status: 'ADDED' },
    ]);
    expect(h.items).toEqual([
      { id: 1, variantId: 2, quantity: 1 },
      { id: 101, cartId: 50, variantId: 1, quantity: 2 },
    ]);
    expect(result.replayed).toBe(false);
  });

  it('replaces the quantity of a shared variant instead of summing', async () => {
    const h = harness({ items: [{ id: 1, variantId: 1, quantity: 5 }] });
    const result = await h.service.transfer(7, base);
    expect(h.items[0].quantity).toBe(2);
    expect(result.rows[0]).toEqual({
      variantId: 1,
      quantity: 2,
      previousQuantity: 5,
      status: 'REPLACED',
    });
  });

  it('reports UNCHANGED without writing when the quantity already matches', async () => {
    const h = harness({ items: [{ id: 1, variantId: 1, quantity: 2 }] });
    const result = await h.service.transfer(7, base);
    expect(result.rows[0].status).toBe('UNCHANGED');
    expect(h.tx.cartItem.update).not.toHaveBeenCalled();
    expect(h.tx.cartItem.create).not.toHaveBeenCalled();
  });

  it('replays the same requestId + payload without touching the cart again', async () => {
    const h = harness();
    const first = await h.service.transfer(7, base);
    h.tx.cartItem.create.mockClear();
    h.tx.cartItem.update.mockClear();
    const second = await h.service.transfer(7, base);
    expect(second.replayed).toBe(true);
    expect(second.rows).toEqual(first.rows);
    expect(h.tx.cartItem.create).not.toHaveBeenCalled();
    expect(h.tx.cartItem.update).not.toHaveBeenCalled();
    expect(h.transfers).toHaveLength(1);
  });

  it('treats a reused requestId with another payload as a conflict', async () => {
    const h = harness();
    await h.service.transfer(7, base);
    await expect(
      h.service.transfer(7, { ...base, rows: [{ variantId: 1, quantity: 3 }] }),
    ).rejects.toMatchObject({ code: 'GUEST_TRANSFER_CONFLICT', status: 409 });
    expect(h.items[0]?.quantity).toBe(2);
  });

  it('scopes the idempotency record to the user', async () => {
    const h = harness({
      transfers: [
        { userId: 8, requestId: base.requestId, payloadHash: 'x', result: '{"rows":[]}' },
      ],
    });
    const result = await h.service.transfer(7, base);
    expect(result.replayed).toBe(false);
    expect(h.tx.cartItem.create).toHaveBeenCalled();
  });

  it('rejects a stale expectedCartVersion with a 409 and the current version', async () => {
    const h = harness({ version: new Date('2026-10-21T09:30:00.000Z') });
    await expect(
      h.service.transfer(7, { ...base, expectedCartVersion: '2026-10-20T10:00:00.000Z' }),
    ).rejects.toMatchObject({
      code: 'CART_VERSION_CONFLICT',
      status: 409,
      details: [{ currentVersion: '2026-10-21T09:30:00.000Z' }],
    });
    expect(h.tx.cartItem.create).not.toHaveBeenCalled();
  });

  it('accepts a matching expectedCartVersion', async () => {
    const h = harness({ version: new Date('2026-10-21T09:30:00.000Z') });
    await expect(
      h.service.transfer(7, { ...base, expectedCartVersion: '2026-10-21T09:30:00.000Z' }),
    ).resolves.toMatchObject({ replayed: false });
  });

  it.each([
    [{ variantId: 999, quantity: 1 }, 'VARIANT_NOT_FOUND'],
    [{ variantId: 4, quantity: 1 }, 'VARIANT_UNAVAILABLE'],
    [{ variantId: 5, quantity: 1 }, 'PRESENTATION_ONLY'],
    [{ variantId: 3, quantity: 1 }, 'OUT_OF_STOCK'],
    [{ variantId: 2, quantity: 6 }, 'OUT_OF_STOCK'],
  ])('rejects row %j with %s and writes nothing', async (row, reason) => {
    const h = harness({ items: [{ id: 1, variantId: 2, quantity: 1 }] });
    await expect(
      h.service.transfer(7, { ...base, rows: [row as any] }),
    ).rejects.toMatchObject({ code: 'CART_ROW_REJECTED', status: 409, details: [{ reason }] });
    expect(h.tx.cartItem.create).not.toHaveBeenCalled();
    expect(h.tx.cartItem.update).not.toHaveBeenCalled();
    expect(h.transfers).toHaveLength(0);
  });

  it('rejects duplicate variant ids before any transaction', async () => {
    const h = harness();
    await expect(
      h.service.transfer(7, {
        ...base,
        rows: [
          { variantId: 1, quantity: 1 },
          { variantId: 1, quantity: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('hashes the payload independently of row order', () => {
    const a = GuestTransferService.payloadHash([
      { variantId: 2, quantity: 1 },
      { variantId: 1, quantity: 3 },
    ]);
    const b = GuestTransferService.payloadHash([
      { variantId: 1, quantity: 3 },
      { variantId: 2, quantity: 1 },
    ]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

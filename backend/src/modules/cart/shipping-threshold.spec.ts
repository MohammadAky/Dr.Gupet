import { CartService } from './cart.service';
import { OrdersService } from '../orders/orders.service';
import { CouponsService } from '../coupons/coupons.service';
import { OrderStockService } from '../orders/order-stock.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../admin/settings/settings.service';

function setup(price: number, quantity = 1, override?: number, discount = 0) {
  const product = {
    id: 1,
    name: 'خوراک',
    slug: 'food',
    isActive: true,
    images: [{ url: '/uploads/main.webp' }],
  };
  const item = {
    id: 1,
    variantId: 2,
    quantity,
    variant: { id: 2, price, stock: 100, weightGram: 500, isActive: true, product },
  };
  const orderCreate = jest.fn(async ({ data }) => ({
    id: 10,
    createdAt: new Date('2026-10-14T10:00:00Z'),
    ...data,
  }));
  const prisma = {
    cart: { findUnique: jest.fn().mockResolvedValue({ id: 1, items: [item] }) },
    address: {
      findUnique: jest.fn().mockResolvedValue({
        id: 4,
        userId: 7,
        title: 'خانه',
        receiverName: 'آزمون',
        receiverPhone: '09999999999',
        province: 'تهران',
        city: 'تهران',
        fullAddress: 'نشانی محلی',
      }),
    },
    cartItem: { findMany: jest.fn().mockResolvedValue([item]), deleteMany: jest.fn() },
    coupon: { findUnique: jest.fn().mockResolvedValue({ id: 3 }) },
    order: { create: orderCreate },
    orderItem: { createMany: jest.fn() },
    couponRedemption: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((operation) => operation(prisma));
  const settings = {
    getNumber: jest.fn(async (key: string, fallback: number) =>
      key === 'FREE_SHIPPING_THRESHOLD' ? (override ?? fallback) : fallback,
    ),
  };
  const config = { get: jest.fn((key: string) => (key === 'payment.driver' ? 'mock' : undefined)) };
  const coupons = { evaluate: jest.fn().mockResolvedValue({ discountAmount: discount }) };
  const stock = { reserve: jest.fn() };
  const client = prisma as unknown as PrismaService;
  const settingClient = settings as unknown as SettingsService;
  const configClient = config as unknown as ConfigService;
  const cart = new CartService(client, settingClient, configClient);
  const orders = new OrdersService(
    client,
    cart,
    coupons as unknown as CouponsService,
    stock as unknown as OrderStockService,
    configClient,
    settingClient,
  );
  return { cart, orders, prisma, settings, coupons, orderCreate };
}

describe('Six-million-Toman shipping threshold, server totals and override', () => {
  it.each([
    [5999999, 50000],
    [6000000, 0],
    [6000001, 0],
  ])('cart and checkout agree at subtotal %i', async (subtotal, expected) => {
    const h = setup(subtotal);
    const cart = await h.cart.getCart(7);
    expect(cart.estimate).toMatchObject({ freeShippingThreshold: 6000000, shippingCost: expected });
    const order = await h.orders.checkout(7, { addressId: 4 });
    expect(order).toMatchObject({
      itemsTotal: subtotal,
      shippingCost: expected,
      finalAmount: subtotal + expected,
    });
    expect(h.settings.getNumber).toHaveBeenCalledWith('FREE_SHIPPING_THRESHOLD', 6000000);
    expect(
      h.prisma.cart.findUnique.mock.calls[0][0].include.items.include.variant.include.product.select
        .images.orderBy,
    ).toEqual([{ sortOrder: 'asc' }, { id: 'asc' }]);
  });
  it('recomputes shipping automatically from quantity and raw authoritative unit price', async () => {
    const h = setup(3000000, 2);
    expect((await h.cart.getCart(7)).estimate.shippingCost).toBe(0);
    expect((await h.orders.checkout(7, { addressId: 4 })).itemsTotal).toBe(6000000);
  });
  it('uses pre-coupon subtotal for free shipping even when discount reduces payable items below threshold', async () => {
    const h = setup(6000000, 1, undefined, 2000000);
    const order = await h.orders.checkout(7, { addressId: 4, couponCode: 'local-only' });
    expect(order).toMatchObject({
      itemsTotal: 6000000,
      discountAmount: 2000000,
      shippingCost: 0,
      finalAmount: 4000000,
    });
    // Issue #16: the coupon is evaluated inside the checkout transaction.
    expect(h.coupons.evaluate).toHaveBeenCalledWith('LOCAL-ONLY', 7, 6000000, expect.anything());
  });
  it.each([
    [7000000, 6000000, 50000],
    [5000000, 5000000, 0],
    [0, 10, 0],
  ])(
    'honors editable database threshold %i over the default',
    async (override, subtotal, expected) => {
      const h = setup(subtotal, 1, override);
      expect((await h.cart.getCart(7)).estimate).toMatchObject({
        freeShippingThreshold: override,
        shippingCost: expected,
      });
      expect((await h.orders.checkout(7, { addressId: 4 })).shippingCost).toBe(expected);
    },
  );
});

import { OrdersService } from './orders.service';

describe('Checkout with payments disabled', () => {
  it('rejects before reading the cart or reserving stock or writing an order', async () => {
    const prisma = { $transaction: jest.fn(), address: { findUnique: jest.fn() } };
    const cart = { getCart: jest.fn() };
    const coupons = { evaluate: jest.fn() };
    const stock = { reserve: jest.fn() };
    const service = new OrdersService(
      prisma as any,
      cart as any,
      coupons as any,
      stock as any,
      { get: (key: string) => (key === 'payment.driver' ? 'disabled' : undefined) } as any,
      { getNumber: jest.fn() } as any,
    );
    await expect(service.checkout(1, { addressId: 1 })).rejects.toMatchObject({
      code: 'PAYMENT_UNAVAILABLE',
      status: 503,
    });
    expect(cart.getCart).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.address.findUnique).not.toHaveBeenCalled();
    expect(stock.reserve).not.toHaveBeenCalled();
    expect(coupons.evaluate).not.toHaveBeenCalled();
  });
});

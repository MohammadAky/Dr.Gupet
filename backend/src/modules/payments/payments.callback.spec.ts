import { PaymentsService } from './payments.service';
import { MockPaymentGateway } from './gateways/mock.gateway';
import { ZarinpalPaymentGateway } from './gateways/zarinpal.gateway';

/**
 * Issues #01, #02, #05 — payment callback hardening:
 * - signed callbacks (HMAC binding paymentId+orderId),
 * - strict `Status === 'OK'` (missing ≠ success),
 * - atomic payment claim + guarded order transition,
 * - refund-review path when money arrives after cancel/expire,
 * - mock verify only accepts mock references; zarinpal uses classic WebGate URLs.
 */

const ORDER = {
  id: 7,
  orderNumber: 'DG-1',
  userId: 42,
  status: 'PENDING_PAYMENT',
  finalAmount: 120000,
  refundNote: null as string | null,
};

function makePrisma(overrides: Record<string, unknown> = {}) {
  const paymentRow = {
    id: 3,
    orderId: 7,
    amount: 120000,
    gateway: 'mock',
    gatewayRef: 'mock-1-3',
    status: 'INITIATED',
    order: { ...ORDER },
    paidAt: null,
  };
  const prisma: any = {
    payment: {
      findUnique: jest.fn().mockResolvedValue(paymentRow),
      create: jest.fn().mockResolvedValue(paymentRow),
      update: jest.fn().mockResolvedValue(paymentRow),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      findUnique: jest.fn().mockResolvedValue({ ...ORDER }),
      update: jest.fn().mockResolvedValue({ ...ORDER }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 42, phone: '09121234567' }),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    ...overrides,
  };
  return prisma;
}

function makeService(opts: {
  driver?: string;
  nodeEnv?: string;
  prisma?: any;
  config?: Record<string, string | undefined>;
} = {}) {
  const prevEnv = process.env.NODE_ENV;
  if (opts.nodeEnv) process.env.NODE_ENV = opts.nodeEnv;
  try {
    const values: Record<string, string | undefined> = {
      'payment.driver': opts.driver ?? 'mock',
      'payment.callbackUrl': 'http://api/payments/callback',
      'payment.callbackSecret': 'sig-secret',
      'payment.mockPayUrl': 'http://api/payments/mock-pay',
      ...opts.config,
    };
    const config = { get: (key: string) => values[key] } as any;
    const prisma = opts.prisma ?? makePrisma();
    const sms = { sendText: jest.fn().mockResolvedValue(undefined), sendOtp: jest.fn() };
    const service = new PaymentsService(prisma, config, sms as any);
    return { service, prisma, sms };
  } finally {
    if (opts.nodeEnv) process.env.NODE_ENV = prevEnv;
  }
}

describe('PaymentsService — driver validation (issues #01, #05)', () => {
  it('rejects an unknown payment driver', () => {
    expect(() => makeService({ driver: 'paypal' })).toThrow(/Unknown PAYMENT_DRIVER/);
  });

  it('rejects the mock driver in production', () => {
    expect(() => makeService({ driver: 'mock', nodeEnv: 'production' })).toThrow(
      /not allowed in production/,
    );
  });

  it('requires a merchant id for zarinpal', () => {
    expect(() => makeService({ driver: 'zarinpal' })).toThrow(/ZARINPAL_MERCHANT_ID/);
  });
});

describe('PaymentsService.startPayment (issue #01)', () => {
  it('binds paymentId and an HMAC signature into the callback URL', async () => {
    const { service, prisma } = makeService();
    const result = await service.startPayment(42, 7);

    expect(result.paymentUrl).toContain('paymentId=3');
    expect(result.paymentUrl).toContain('sig=');
    const created = prisma.payment.create.mock.calls[0][0].data;
    expect(created.gateway).toBe('mock');
    const { service: verifier } = makeService();
    const sig = new URL(result.paymentUrl).searchParams.get('sig') ?? '';
    expect(verifier.verifyCallbackSig(3, 7, sig)).toBe(true);
    expect(verifier.verifyCallbackSig(3, 7, 'forged')).toBe(false);
  });

  it('rejects orders that are not pending payment or belong to someone else', async () => {
    const { service } = makeService();
    await expect(service.startPayment(99, 7)).rejects.toThrow('سفارش یافت نشد');

    const prisma = makePrisma();
    prisma.order.findUnique = jest.fn().mockResolvedValue({ ...ORDER, status: 'PAID' });
    const other = makeService({ prisma });
    await expect(other.service.startPayment(42, 7)).rejects.toThrow('قابل پرداخت');
  });
});

describe('PaymentsService.handleCallback (issues #01, #02)', () => {
  it('rejects a callback without a valid signature', async () => {
    const { service } = makeService();
    await expect(service.handleCallback(3, { statusRaw: 'OK' })).rejects.toThrow(
      'پرداخت یافت نشد',
    );
    await expect(service.handleCallback(3, { statusRaw: 'OK', sig: 'bad' })).rejects.toThrow(
      'پرداخت یافت نشد',
    );
  });

  it('treats a missing Status as failure (issue #01: empty ≠ success)', async () => {
    const { service, prisma } = makeService();
    const sig = service.verifyCallbackSig.bind(service);
    void sig;
    // compute a valid signature through a helper service with same secret
    const valid = validSig(service, 3, 7);

    const result = await service.handleCallback(3, { sig: valid });
    expect(result.success).toBe(false);
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 3 }),
        data: { status: 'FAILED' },
      }),
    );
  });

  it('marks the order PAID only from PENDING_PAYMENT when Status=OK and verify passes', async () => {
    const { service, prisma, sms } = makeService();
    const valid = validSig(service, 3, 7);

    const result = await service.handleCallback(3, { statusRaw: 'OK', sig: valid });
    expect(result).toMatchObject({ success: true, needsReview: false, orderNumber: 'DG-1' });

    const orderClaim = prisma.order.updateMany.mock.calls.find(
      (c: any[]) => c[0].data?.status === 'PAID',
    );
    expect(orderClaim[0].where).toMatchObject({ id: 7, status: 'PENDING_PAYMENT' });
    expect(sms.sendText).toHaveBeenCalled();
  });

  it('is idempotent for an already-successful payment', async () => {
    const prisma = makePrisma();
    prisma.payment.findUnique = jest.fn().mockResolvedValue({
      id: 3,
      orderId: 7,
      status: 'SUCCESS',
      gatewayRef: 'mock-1-3',
      amount: 120000,
      order: { ...ORDER, status: 'PAID' },
    });
    const { service } = makeService({ prisma });
    const result = await service.handleCallback(3, { statusRaw: 'OK', sig: validSig(service, 3, 7) });
    expect(result.success).toBe(true);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('sends a late payment to refund review instead of PAID (issue #02)', async () => {
    const prisma = makePrisma();
    // order already canceled → the guarded transition matches nothing
    prisma.order.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const { service } = makeService({ prisma });

    const result = await service.handleCallback(3, { statusRaw: 'OK', sig: validSig(service, 3, 7) });
    expect(result).toMatchObject({ success: true, needsReview: true });
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({ refundNote: expect.stringContaining('استرداد') }),
      }),
    );
  });

  it('treats a lost concurrent claim as idempotent success', async () => {
    const prisma = makePrisma();
    prisma.payment.updateMany = jest.fn().mockResolvedValue({ count: 0 }); // lost the race
    const { service } = makeService({ prisma });
    const result = await service.handleCallback(3, { statusRaw: 'OK', sig: validSig(service, 3, 7) });
    expect(result).toMatchObject({ success: true, needsReview: false });
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });
});

describe('MockPaymentGateway (issues #01, #05)', () => {
  it('links to the mock page with paymentId and signature', async () => {
    const gw = new MockPaymentGateway('http://api/payments/mock-pay');
    const res = await gw.request({
      amount: 1000,
      orderId: 7,
      paymentId: 3,
      callbackSig: 'sig',
      description: 'x',
      callbackUrl: 'cb',
    });
    expect(res.paymentUrl).toContain('paymentId=3');
    expect(res.paymentUrl).toContain('sig=sig');
    expect(res.gatewayRef).toContain('mock-');
  });

  it('only verifies references it issued', async () => {
    const gw = new MockPaymentGateway();
    await expect(gw.verify('mock-1', 10)).resolves.toMatchObject({ success: true });
    await expect(gw.verify('forged-ref', 10)).resolves.toMatchObject({ success: false });
    await expect(gw.verify('', 10)).resolves.toMatchObject({ success: false });
  });
});

describe('ZarinpalPaymentGateway (issue #05)', () => {
  function fakeFetch(result: unknown) {
    return jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => result,
    }) as unknown as typeof fetch;
  }

  it('uses classic WebGate PaymentRequest.json and converts Toman→Rial', async () => {
    const fetchImpl = fakeFetch({ Status: 100, Authority: 'A0001' });
    const gw = new ZarinpalPaymentGateway('M-1', false, undefined, undefined, fetchImpl);
    const res = await gw.request({
      amount: 120000,
      orderId: 7,
      paymentId: 3,
      callbackSig: 's',
      description: 'd',
      callbackUrl: 'http://api/cb',
    });

    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0];
    expect(url).toBe('https://ir.zarinpal.com/pg/rest/WebGate/PaymentRequest.json');
    const body = JSON.parse((init as any).body);
    expect(body.Amount).toBe(1200000); // ×10
    expect(body.MerchantID).toBe('M-1');
    expect(res).toEqual({ gatewayRef: 'A0001', paymentUrl: 'https://www.zarinpal.com/pg/StartPay/A0001' });
  });

  it('honours the sandbox base URLs', async () => {
    const fetchImpl = fakeFetch({ Status: 100, Authority: 'A1' });
    const gw = new ZarinpalPaymentGateway('M-1', true, undefined, undefined, fetchImpl);
    const res = await gw.request({
      amount: 1,
      orderId: 1,
      paymentId: 1,
      callbackSig: 's',
      description: 'd',
      callbackUrl: 'cb',
    });
    const [url] = (fetchImpl as jest.Mock).mock.calls[0];
    expect(url).toContain('sandbox.zarinpal.com/pg/rest/WebGate/PaymentRequest.json');
    expect(res.paymentUrl).toContain('sandbox.zarinpal.com/pg/StartPay/');
  });

  it('treats Status 100/101 as verified and anything else as failed', async () => {
    for (const [status, success] of [
      [100, true],
      [101, true],
      [102, false],
      [-51, false],
    ] as const) {
      const gw = new ZarinpalPaymentGateway('M-1', true, undefined, undefined, fakeFetch({ Status: status }));
      const res = await gw.verify('A1', 500);
      expect(res.success).toBe(success);
    }
  });

  it('throws when the gateway refuses the request', async () => {
    const gw = new ZarinpalPaymentGateway(
      'M-1',
      true,
      undefined,
      undefined,
      fakeFetch({ Status: -9 }),
    );
    await expect(
      gw.request({ amount: 1, orderId: 1, paymentId: 1, callbackSig: 's', description: 'd', callbackUrl: 'cb' }),
    ).rejects.toThrow(/Status=-9/);
  });
});

/** Produce a valid callback signature with the service under test. */
function validSig(service: PaymentsService, paymentId: number, orderId: number): string {
  const anyService = service as any;
  return anyService.callbackSig(paymentId, orderId);
}

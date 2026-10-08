import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../../sms/sms.service';
import { AdminPaymentsService } from './admin-payments.service';
import { MockPaymentGateway } from './gateways/mock.gateway';
import { ZarinpalPaymentGateway } from './gateways/zarinpal.gateway';
import { PaymentsService } from './payments.service';

jest.mock('./gateways/mock.gateway');
jest.mock('./gateways/zarinpal.gateway');

function makeDisabledService() {
  const dbCall = jest.fn();
  const prisma = {
    order: { findUnique: dbCall, update: dbCall, updateMany: dbCall },
    payment: {
      findUnique: dbCall,
      create: dbCall,
      update: dbCall,
      updateMany: dbCall,
    },
    user: { findUnique: dbCall },
    $transaction: dbCall,
  } as unknown as PrismaService;
  const values: Record<string, unknown> = {
    'app.nodeEnv': 'production',
    'payment.driver': 'disabled',
  };
  const config = { get: jest.fn((key: string) => values[key]) };
  const sms = { sendText: jest.fn(), sendOtp: jest.fn() };
  const service = new PaymentsService(
    prisma,
    config as unknown as ConfigService,
    sms as unknown as SmsService,
  );
  const admin = new AdminPaymentsService(prisma, service);
  return { service, admin, prisma, dbCall, config, sms };
}

describe('Disabled production payments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts without merchant credentials and constructs no payment gateway', () => {
    const { dbCall, config, sms } = makeDisabledService();

    expect(MockPaymentGateway).not.toHaveBeenCalled();
    expect(ZarinpalPaymentGateway).not.toHaveBeenCalled();
    expect(config.get).not.toHaveBeenCalledWith('payment.zarinpalMerchantId');
    expect(dbCall).not.toHaveBeenCalled();
    expect(sms.sendText).not.toHaveBeenCalled();
  });

  it.each([
    [
      'start',
      (service: PaymentsService, _admin: AdminPaymentsService) => service.startPayment(42, 7),
    ],
    [
      'callback',
      (service: PaymentsService, _admin: AdminPaymentsService) =>
        service.handleCallback(3, { statusRaw: 'OK', sig: 'signature' }),
    ],
    [
      'invalid callback',
      (service: PaymentsService, _admin: AdminPaymentsService) => service.handleCallback(0, {}),
    ],
    [
      'admin callback',
      (service: PaymentsService, _admin: AdminPaymentsService) =>
        service.handleCallback(3, { adminReconcile: true }),
    ],
    [
      'admin reconcile',
      (_service: PaymentsService, admin: AdminPaymentsService) => admin.reconcile(3),
    ],
    [
      'admin mark failed',
      (_service: PaymentsService, admin: AdminPaymentsService) => admin.markFailed(3),
    ],
  ] as const)('rejects %s before any database or SMS work', async (_name, action) => {
    const { service, admin, dbCall, sms } = makeDisabledService();
    const result = action(service, admin);

    await expect(result).rejects.toMatchObject({
      code: 'PAYMENT_UNAVAILABLE',
      message: 'پرداخت آنلاین در حال حاضر در دسترس نیست',
    });
    await expect(result).rejects.toBeInstanceOf(AppException);
    await expect(result).rejects.toMatchObject({ status: 503 });
    expect(dbCall).not.toHaveBeenCalled();
    expect(MockPaymentGateway).not.toHaveBeenCalled();
    expect(ZarinpalPaymentGateway).not.toHaveBeenCalled();
    expect(sms.sendText).not.toHaveBeenCalled();
    expect(sms.sendOtp).not.toHaveBeenCalled();
  });

  it('continues to reject mock payments in production before constructing a gateway', () => {
    const values: Record<string, string> = {
      'app.nodeEnv': 'production',
      'payment.driver': 'mock',
    };
    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
    expect(() => new PaymentsService({} as PrismaService, config, {} as SmsService)).toThrow(
      'PAYMENT_DRIVER=mock is not allowed in production',
    );
    expect(MockPaymentGateway).not.toHaveBeenCalled();
  });
});

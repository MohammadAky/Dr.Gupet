import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGateway } from './gateways/payment-gateway.interface';
import { MockPaymentGateway } from './gateways/mock.gateway';
import { ZarinpalPaymentGateway } from './gateways/zarinpal.gateway';
import { SmsService } from '../../sms/sms.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

export type CallbackOutcome = 'paid' | 'failed' | 'review';

export interface CallbackResult {
  success: boolean;
  needsReview: boolean;
  orderId: number;
  orderNumber: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly gateway: PaymentGateway | null;
  private readonly driver: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private sms: SmsService,
  ) {
    // Strict driver selection (issues #01, #05): unknown drivers are refused
    // everywhere, and the mock driver is refused in production.
    const driver = this.configService.get<string>('payment.driver') || 'mock';
    if (driver !== 'mock' && driver !== 'zarinpal' && driver !== 'disabled') {
      throw new Error(`Unknown PAYMENT_DRIVER "${driver}" — expected "mock", "zarinpal" or "disabled"`);
    }
    const nodeEnv = this.configService.get<string>('app.nodeEnv') || process.env.NODE_ENV;
    if (driver === 'mock' && nodeEnv === 'production') {
      throw new Error('PAYMENT_DRIVER=mock is not allowed in production');
    }
    this.driver = driver;

    if (driver === 'zarinpal') {
      const merchantId = this.configService.get<string>('payment.zarinpalMerchantId');
      if (!merchantId) {
        throw new Error('ZARINPAL_MERCHANT_ID is required when PAYMENT_DRIVER=zarinpal');
      }
      this.gateway = new ZarinpalPaymentGateway(
        merchantId,
        this.parseBool(this.configService.get('payment.zarinpalSandbox')),
        this.configService.get<string>('payment.zarinpalApiBase'),
        this.configService.get<string>('payment.zarinpalStartPayBase'),
      );
    } else if (driver === 'mock') {
      this.gateway = new MockPaymentGateway(
        this.configService.get<string>('payment.mockPayUrl') ||
          'http://localhost:3000/api/v1/payments/mock-pay',
      );
    } else {
      this.gateway = null;
    }
  }

  assertPaymentsAvailable(): void {
    this.getAvailableGateway();
  }

  private getAvailableGateway(): PaymentGateway {
    if (!this.gateway) {
      throw new AppException('PAYMENT_UNAVAILABLE', 'پرداخت آنلاین در حال حاضر در دسترس نیست', 503);
    }
    return this.gateway;
  }

  private parseBool(value: unknown): boolean {
    return value === true || value === 'true';
  }

  /** HMAC that binds a callback to the genuine startPayment transaction (issue #01). */
  private callbackSig(paymentId: number, orderId: number): string {
    const secret =
      this.configService.get<string>('payment.callbackSecret') ||
      this.configService.get<string>('jwt.accessSecret') ||
      'change-me';
    return crypto
      .createHmac('sha256', secret)
      .update(`payment:${paymentId}:${orderId}`)
      .digest('hex');
  }

  verifyCallbackSig(paymentId: number, orderId: number, sig: string | undefined): boolean {
    if (!sig) return false;
    const expected = this.callbackSig(paymentId, orderId);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(sig));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * Start payment for an order
   */
  async startPayment(userId: number, orderId: number) {
    const gateway = this.getAvailableGateway();
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new NotFoundException('سفارش قابل پرداخت نیست');
    }

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.finalAmount,
        gateway: this.driver,
        status: 'INITIATED',
      },
    });

    // Callback URL carries paymentId + signature so only callbacks that belong
    // to this exact transaction can change order/payment state (issue #01).
    const callbackBase = this.configService.get<string>('payment.callbackUrl') || '';
    const sep = callbackBase.includes('?') ? '&' : '?';
    const sig = this.callbackSig(payment.id, order.id);
    const callbackUrl = `${callbackBase}${sep}paymentId=${payment.id}&sig=${sig}`;

    const result = await gateway.request({
      amount: order.finalAmount,
      orderId: order.id,
      paymentId: payment.id,
      callbackSig: sig,
      description: `پرداخت سفارش ${order.orderNumber}`,
      callbackUrl,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayRef: result.gatewayRef },
    });

    return { paymentUrl: result.paymentUrl };
  }

  /**
   * Handle payment callback.
   *
   * Hardened per issues #01/#02:
   * - the callback must carry the signature issued at startPayment;
   * - `Status` must be exactly 'OK' (missing/NOK → failed);
   * - payment is claimed atomically (one winner under concurrency);
   * - order transitions to PAID only from PENDING_PAYMENT — a payment that
   *   lands after cancel/expire goes to a manual-review/refund path instead.
   */
  async handleCallback(
    paymentId: number,
    opts: { statusRaw?: string; sig?: string; adminReconcile?: boolean },
  ): Promise<CallbackResult> {
    const gateway = this.getAvailableGateway();
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      throw new NotFoundException('پرداخت یافت نشد');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('پرداخت یافت نشد');
    }

    const base = {
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
    };

    // Signature binds the callback to the genuine startPayment transaction.
    // Admin reconciliation is already behind JWT + ADMIN role (issue #01).
    if (!opts.adminReconcile && !this.verifyCallbackSig(paymentId, payment.orderId, opts.sig)) {
      this.logger.warn(`payment callback rejected: invalid signature (payment ${paymentId})`);
      throw new NotFoundException('پرداخت یافت نشد');
    }

    // Idempotent: an already-successful payment stays successful.
    if (payment.status === 'SUCCESS') {
      return {
        success: true,
        needsReview: Boolean(payment.order.refundNote),
        ...base,
      };
    }

    if (payment.status === 'FAILED') {
      return { success: false, needsReview: false, ...base };
    }

    // Strict: only an explicit gateway 'OK' counts as a success attempt.
    // Admin reconciliation re-verifies against the gateway regardless.
    if (!opts.adminReconcile && opts.statusRaw !== 'OK') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ['INITIATED', 'PENDING'] } },
        data: { status: 'FAILED' },
      });
      return { success: false, needsReview: false, ...base };
    }

    // Server-to-server verification with the gateway.
    let verified = false;
    try {
      const verifyResult = await gateway.verify(payment.gatewayRef || '', payment.amount);
      verified = verifyResult.success;
    } catch (error) {
      this.logger.error(`payment verify call failed: ${(error as Error).message}`);
      verified = false;
    }

    if (!verified) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ['INITIATED', 'PENDING'] } },
        data: { status: 'FAILED' },
      });
      return { success: false, needsReview: false, ...base };
    }

    // Atomic claim + guarded order transition (issue #02).
    const outcome: CallbackOutcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ['INITIATED', 'PENDING'] } },
        data: { status: 'SUCCESS', paidAt: new Date() },
      });

      if (claimed.count === 0) {
        // A concurrent callback won the race — treat as idempotent success.
        return 'paid';
      }

      const transitioned = await tx.order.updateMany({
        where: { id: payment.orderId, status: 'PENDING_PAYMENT' },
        data: { status: 'PAID' },
      });

      return transitioned.count === 1 ? 'paid' : 'review';
    });

    if (outcome === 'review') {
      // Money captured but the order was already canceled/expired — flag it
      // for manual refund handling instead of silently marking it PAID.
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          refundNote: 'پرداخت پس از لغو/انقضای سفارش ثبت شد — نیازمند بررسی و استرداد دستی',
        },
      });
      this.logger.warn(
        `payment ${payment.id} succeeded after order ${payment.order.orderNumber} left PENDING_PAYMENT — needs refund review`,
      );
      return { success: true, needsReview: true, ...base };
    }

    // Send SMS notification (fail silently) — notification policy from config.
    const notifyEnabled = this.configService.get<boolean>('sms.notifyPaymentSuccess') !== false;
    if (notifyEnabled) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: payment.order.userId },
        });
        if (user) {
          await this.sms.sendText(
            user.phone,
            `پرداخت سفارش ${payment.order.orderNumber} با موفقیت انجام شد.`,
          );
        }
      } catch (error) {
        this.logger.warn(`payment success notification failed: ${(error as Error).message}`);
      }
    }

    return { success: true, needsReview: false, ...base };
  }
}

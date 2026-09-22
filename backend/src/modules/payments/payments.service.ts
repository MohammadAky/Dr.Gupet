import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGateway } from './gateways/payment-gateway.interface';
import { MockPaymentGateway } from './gateways/mock.gateway';
import { ZarinpalPaymentGateway } from './gateways/zarinpal.gateway';
import { SmsService } from '../../sms/sms.service';

@Injectable()
export class PaymentsService {
  private gateway: PaymentGateway;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private sms: SmsService,
  ) {
    // Initialize gateway based on PAYMENT_DRIVER
    const driver = this.configService.get<string>('payment.driver') || 'mock';

    if (driver === 'zarinpal') {
      this.gateway = new ZarinpalPaymentGateway(
        this.configService.get<string>('payment.zarinpalMerchantId') || '',
        this.configService.get<boolean>('payment.zarinpalSandbox') || true,
      );
    } else {
      this.gateway = new MockPaymentGateway();
    }
  }

  /**
   * Start payment for an order
   */
  async startPayment(userId: number, orderId: number) {
    // Find order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new NotFoundException('سفارش قابل پرداخت نیست');
    }

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.finalAmount,
        gateway: this.configService.get<string>('payment.driver') || 'mock',
        status: PaymentStatus.INITIATED,
      },
    });

    // Call gateway
    const callbackUrl = this.configService.get<string>('payment.callbackUrl') || '';
    const result = await this.gateway.request({
      amount: order.finalAmount,
      orderId: order.id,
      description: `پرداخت سفارش ${order.orderNumber}`,
      callbackUrl: `${callbackUrl}?paymentId=${payment.id}`,
    });

    // Save gateway reference
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayRef: result.gatewayRef },
    });

    return { paymentUrl: result.paymentUrl };
  }

  /**
   * Handle payment callback
   */
  async handleCallback(paymentId: number, success: boolean) {
    // Find payment
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('پرداخت یافت نشد');
    }

    // Idempotent: if already successful, just return
    if (payment.status === PaymentStatus.SUCCESS) {
      return { success: true, orderNumber: payment.order.orderNumber };
    }

    if (!success) {
      // Mark as failed
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });

      return { success: false, orderNumber: payment.order.orderNumber };
    }

    // Verify with gateway (server-to-server)
    const verifyResult = await this.gateway.verify(
      payment.gatewayRef || '',
      payment.amount,
    );

    if (!verifyResult.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });

      return { success: false, orderNumber: payment.order.orderNumber };
    }

    // Mark payment as success and order as PAID in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          paidAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.PAID },
      });
    });

    // Send SMS notification (fail silently)
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
      // SMS failure should not break payment flow
    }

    return { success: true, orderNumber: payment.order.orderNumber };
  }
}
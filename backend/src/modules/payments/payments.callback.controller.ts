import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsCallbackController {
  constructor(
    private paymentsService: PaymentsService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'Payment callback from gateway (signed, Status required)' })
  @ApiQuery({ name: 'paymentId', type: Number })
  @ApiQuery({ name: 'sig', type: String })
  @ApiQuery({ name: 'Status', type: String, required: false })
  async handleCallback(
    @Query('paymentId') paymentId: string,
    @Query('sig') sig: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const statusRaw = req.query.Status as string | undefined;

    // Missing/NOK Status is a failed attempt (issue #01: empty ≠ success).
    const result = await this.paymentsService.handleCallback(Number(paymentId), {
      statusRaw,
      sig,
    });

    const frontendUrl =
      this.configService.get<string>('payment.frontendResultUrl') ||
      'http://localhost:5173/payment/result';
    const outcome = result.needsReview ? 'review' : result.success ? 'success' : 'failed';
    const redirectUrl = `${frontendUrl}?orderId=${result.orderId}&orderNumber=${result.orderNumber}&status=${outcome}`;

    res.redirect(redirectUrl);
  }

  @ApiBearerAuth()
  @Get('mock-pay')
  @ApiOperation({ summary: 'Mock payment page — development/test only' })
  async mockPay(
    @Query('paymentId') paymentIdRaw: string,
    @Query('sig') sig: string | undefined,
    @Query('orderId') orderIdRaw: string,
    @Query('amount') _amount: string,
    @CurrentUser('sub') userId: number,
    @CurrentUser('role') role: string,
    @Res() res: Response,
  ) {
    // The simulated bank page only exists outside production (issue #01).
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    const paymentId = Number(paymentIdRaw);
    const orderId = Number(orderIdRaw);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      throw new NotFoundException('پرداخت یافت نشد');
    }

    // Ownership: only the order owner (or an admin) may drive the mock page.
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { userId: true } } },
    });
    if (!payment || payment.orderId !== orderId) {
      throw new NotFoundException('پرداخت یافت نشد');
    }
    if (payment.order.userId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException('شما مجاز به پرداخت این سفارش نیستید');
    }

    // Forward to the signed callback as an explicit gateway success.
    const callbackUrl =
      this.configService.get<string>('payment.callbackUrl') ||
      'http://localhost:3000/api/v1/payments/callback';
    const sep = callbackUrl.includes('?') ? '&' : '?';
    res.redirect(
      `${callbackUrl}${sep}paymentId=${paymentId}&sig=${encodeURIComponent(sig ?? '')}&Status=OK`,
    );
  }
}

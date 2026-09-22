import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsCallbackController {
  constructor(
    private paymentsService: PaymentsService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'Payment callback from gateway' })
  @ApiQuery({ name: 'paymentId', type: Number })
  async handleCallback(
    @Query('paymentId') paymentId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Check success based on gateway
    // For mock: always success
    // For Zarinpal: check Status query param
    const status = req.query.Status as string;
    const success = status === 'OK' || status === undefined;

    const result = await this.paymentsService.handleCallback(
      Number(paymentId),
      success,
    );

    // Redirect to frontend result page
    const frontendUrl = this.configService.get<string>('payment.frontendResultUrl') || 'http://localhost:5173/payment/result';
    const redirectUrl = `${frontendUrl}?orderNumber=${result.orderNumber}&status=${result.success ? 'success' : 'failed'}`;

    res.redirect(redirectUrl);
  }

  @Public()
  @Get('mock-pay')
  @ApiOperation({ summary: 'Mock payment page (dev only)' })
  async mockPay(
    @Query('orderId') orderId: number,
    @Query('amount') amount: number,
    @Query('paymentId') paymentId: number,
    @Res() res: Response,
  ) {
    // In dev mode, auto-redirect to callback with success
    const callbackUrl = this.configService.get<string>('payment.callbackUrl') || 'http://localhost:3000/api/v1/payments/callback';
    res.redirect(`${callbackUrl}?paymentId=${paymentId}&Status=OK`);
  }
}
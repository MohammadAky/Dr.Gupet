import { Controller, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { StartPaymentDto } from './dto/start-payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start payment for an order' })
  @ApiResponse({ status: 200, description: 'Payment URL returned' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async startPayment(
    @CurrentUser('sub') userId: number,
    @Body() dto: StartPaymentDto,
  ) {
    return this.paymentsService.startPayment(userId, dto.orderId);
  }
}
import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { ERROR_FA, errorText, ORDER_STATUS_FA } from './labels';

describe('errorText', () => {
  it('prefers the server-provided persian message', () => {
    const error = new ApiError({
      success: false,
      statusCode: 400,
      code: 'COUPON_MIN_AMOUNT',
      message: 'حداقل مبلغ سفارش ۱٬۰۰۰٬۰۰۰ تومان است',
    });
    expect(errorText(error)).toBe('حداقل مبلغ سفارش ۱٬۰۰۰٬۰۰۰ تومان است');
  });

  it('falls back to the stable code', () => {
    const error = new ApiError({
      success: false,
      statusCode: 400,
      code: 'OUT_OF_STOCK',
      message: 'HTTP 400',
    });
    expect(errorText(error)).toBe(ERROR_FA.OUT_OF_STOCK);
  });

  it('covers every backend error code from README 6.3', () => {
    const codes = [
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'LIMIT_REACHED',
      'OTP_INVALID',
      'OTP_EXPIRED',
      'OTP_RATE_LIMITED',
      'USER_BLOCKED',
      'VARIANT_UNAVAILABLE',
      'OUT_OF_STOCK',
      'CART_EMPTY',
      'COUPON_INVALID',
      'COUPON_EXPIRED',
      'COUPON_LIMIT_REACHED',
      'COUPON_MIN_AMOUNT',
      'ORDER_INVALID_STATE',
      'PAYMENT_FAILED',
      'INTERNAL_ERROR',
    ];
    for (const code of codes) expect(ERROR_FA[code]).toBeTruthy();
  });

  it('labels every order status', () => {
    for (const status of [
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELED',
    ] as const) {
      expect(ORDER_STATUS_FA[status]).toBeTruthy();
    }
  });
});

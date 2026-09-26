/** Stable English error codes returned by the backend (README §6.3). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LIMIT_REACHED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_RATE_LIMITED'
  | 'USER_BLOCKED'
  | 'VARIANT_UNAVAILABLE'
  | 'OUT_OF_STOCK'
  | 'CART_EMPTY'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'COUPON_LIMIT_REACHED'
  | 'COUPON_MIN_AMOUNT'
  | 'ORDER_INVALID_STATE'
  | 'PAYMENT_FAILED'
  | 'INTERNAL_ERROR';

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

/** Failure envelope: { success: false, statusCode, code, message, details? } */
export interface ApiFailure {
  success: false;
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  details?: ApiErrorDetail[];
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode | string;
  readonly details?: ApiErrorDetail[];

  constructor(failure: ApiFailure) {
    super(failure.message);
    this.name = 'ApiError';
    this.statusCode = failure.statusCode;
    this.code = failure.code;
    this.details = failure.details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** True when the failure is the user being signed out (refresh failed / token gone). */
export function isUnauthorized(value: unknown): boolean {
  return isApiError(value) && (value.statusCode === 401 || value.code === 'UNAUTHORIZED');
}

import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    statusCode: number = HttpStatus.BAD_REQUEST,
    public readonly details?: any[],
  ) {
    super({ code, message, statusCode, details }, statusCode);
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'خطای داخلی سرور';
    let details: any[] | undefined;

    if (exception instanceof AppException) {
      statusCode = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = (exception.getResponse() as { details?: unknown[] }).details;
    } else if (exception instanceof MulterError) {
      // Issue #24: parser limits are a client mistake, never a 500.
      statusCode =
        exception.code === 'LIMIT_FILE_SIZE'
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST;
      code = exception.code === 'LIMIT_FILE_SIZE' ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR';
      message =
        exception.code === 'LIMIT_FILE_SIZE'
          ? 'حجم فایل بیش از حد مجاز است'
          : 'درخواست آپلود معتبر نیست';
      details = [{ field: exception.field, reason: exception.code }];
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      message = typeof response === 'string' ? response : (response as any).message;
      code = this.getErrorCode(statusCode);
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      code,
      message,
      ...(details && { details }),
    });
  }

  private getErrorCode(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 413:
        return 'PAYLOAD_TOO_LARGE';
      case 429:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}

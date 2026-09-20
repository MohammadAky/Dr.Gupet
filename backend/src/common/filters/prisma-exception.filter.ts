import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { AppException } from './all-exceptions.filter';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'خطای داخلی سرور';

    switch (exception.code) {
      case 'P2002': {
        statusCode = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        const target = (exception.meta?.target as string[])?.join(', ') || 'فیلد';
        message = `مقدار تکراری برای ${target} وارد شده است`;
        break;
      }
      case 'P2025': {
        statusCode = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'رکورد مورد نظر یافت نشد';
        break;
      }
      case 'P2003': {
        statusCode = HttpStatus.BAD_REQUEST;
        code = 'VALIDATION_ERROR';
        message = 'فیلد مرجع نامعتبر است';
        break;
      }
      default:
        break;
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      code,
      message,
    });
  }
}
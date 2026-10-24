import { ArgumentsHost } from '@nestjs/common';
import { MulterError } from 'multer';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { multerLimits } from './upload.module';

function hostFor(json: jest.Mock, status: jest.Mock): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
  } as unknown as ArgumentsHost;
}

describe('Multer parser limits (issue #24)', () => {
  it('allows exactly one file part and a short field name', () => {
    expect(multerLimits(5)).toEqual({
      fileSize: 5 * 1024 * 1024,
      files: 1,
      fields: 1,
      parts: 2,
      fieldNameSize: 64,
      fieldSize: 256,
      headerPairs: 20,
    });
  });

  it.each([undefined, Number.NaN, 0, -3])('falls back to 5 MB for %p', (value) => {
    expect(multerLimits(value as number | undefined).fileSize).toBe(5 * 1024 * 1024);
  });

  it('lets the configured UPLOAD_MAX_MB decide the byte cap', () => {
    expect(multerLimits(10).fileSize).toBe(10 * 1024 * 1024);
  });
});

describe('multipart error mapping', () => {
  it.each([
    ['LIMIT_FILE_SIZE', 413, 'PAYLOAD_TOO_LARGE'],
    ['LIMIT_FILE_COUNT', 400, 'VALIDATION_ERROR'],
    ['LIMIT_PART_COUNT', 400, 'VALIDATION_ERROR'],
    ['LIMIT_FIELD_NAME_SIZE', 400, 'VALIDATION_ERROR'],
  ] as const)('maps %s to %i/%s instead of a 500', (code, status, envelope) => {
    const statusMock = jest.fn().mockReturnThis();
    const json = jest.fn().mockReturnThis();
    new AllExceptionsFilter().catch(
      new MulterError(code as MulterError['code'], 'file'),
      hostFor(json, statusMock),
    );
    expect(statusMock).toHaveBeenCalledWith(status);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, statusCode: status, code: envelope }),
    );
  });
});

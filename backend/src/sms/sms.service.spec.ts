import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

type ConfigValues = Record<string, string | undefined>;

function makeService(driver?: string): SmsService {
  const values: ConfigValues = { 'sms.driver': driver };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  return new SmsService(config);
}

const fetchMock = jest.fn();

describe('SmsService driver selection', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('defaults to the console driver (no network)', async () => {
    const service = makeService(undefined);

    await expect(service.sendOtp('09121234567', '123456')).resolves.toBeUndefined();
    await expect(service.sendText('09121234567', 'متن')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to console for an unknown driver', async () => {
    const service = makeService('kavenegar');

    await expect(service.sendOtp('09121234567', '123456')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the sms.ir driver when SMS_DRIVER=smsir (missing config fails fast)', async () => {
    const service = makeService('smsir');

    // No SMS_API_KEY configured → the real driver rejects before any network call.
    await expect(service.sendOtp('09121234567', '123456')).rejects.toThrow(
      'SMS_API_KEY is missing',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

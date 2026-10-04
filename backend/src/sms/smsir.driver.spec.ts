import { ConfigService } from '@nestjs/config';
import { SmsIrDriver } from './smsir.driver';

type ConfigValues = Record<string, string | undefined>;

function makeDriver(overrides: ConfigValues = {}): SmsIrDriver {
  const values: ConfigValues = {
    'sms.apiKey': 'test-api-key',
    'sms.templateId': '123456',
    'sms.paramName': 'Code',
    'sms.baseUrl': 'https://api.sms.ir/v1',
    'sms.lineNumber': '1000500000',
    ...overrides,
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  return new SmsIrDriver(config);
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn();

function call(index: number) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, body: JSON.parse(String(init.body)) as Record<string, unknown> };
}

const lastCall = () => call(fetchMock.mock.calls.length - 1);

describe('SmsIrDriver', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('sendOtp (POST /send/verify)', () => {
    it('sends the template payload with a normalized mobile and X-API-KEY header', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ status: 1, message: 'موفق', data: { messageId: 42 } }),
      );
      const driver = makeDriver();

      await driver.sendOtp('09121234567', '123456');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const { url, init, body } = lastCall();
      expect(url).toBe('https://api.sms.ir/v1/send/verify');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['X-API-KEY']).toBe('test-api-key');
      expect(body).toEqual({
        mobile: '09121234567',
        templateId: 123456,
        parameters: [{ name: 'Code', value: '123456' }],
      });
    });

    it('normalizes 989… / +989… / 9… formats to 09…', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: 1, message: 'موفق', data: {} }));
      const driver = makeDriver();

      await driver.sendOtp('989121234567', '111111');
      await driver.sendOtp('+989121234567', '222222');
      await driver.sendOtp('9121234567', '333333');

      expect(call(0).body.mobile).toBe('09121234567');
      expect(call(1).body.mobile).toBe('09121234567');
      expect(call(2).body.mobile).toBe('09121234567');
    });

    it('rejects a non-Iranian number without calling the API', async () => {
      const driver = makeDriver();

      await expect(driver.sendOtp('12345', '123456')).rejects.toThrow(
        'invalid Iranian mobile number',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails fast when SMS_API_KEY / SMS_IR_TEMPLATE_ID are missing', async () => {
      const noKey = makeDriver({ 'sms.apiKey': undefined });
      await expect(noKey.sendOtp('09121234567', '123456')).rejects.toThrow(
        'SMS_API_KEY is missing',
      );

      const noTemplate = makeDriver({ 'sms.templateId': undefined });
      await expect(noTemplate.sendOtp('09121234567', '123456')).rejects.toThrow(
        'SMS_IR_TEMPLATE_ID is missing',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws on a logical error (status !== 1) without retrying', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: 113, message: 'قالب یافت نشد' }, 400));
      const driver = makeDriver();

      await expect(driver.sendOtp('09121234567', '123456')).rejects.toThrow('status=113');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries once on a transient status (20) and then succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ status: 20, message: 'تعداد درخواست بیش از حد مجاز' }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ status: 1, message: 'موفق', data: { messageId: 7 } }),
        );
      const driver = makeDriver();

      await expect(driver.sendOtp('09121234567', '123456')).resolves.toEqual({ messageId: 7 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting retries on persistent transient failures', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: 20, message: 'rate limited' }));
      const driver = makeDriver();

      await expect(driver.sendOtp('09121234567', '123456')).rejects.toThrow(
        'sms.ir /send/verify failed',
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendText (POST /send/bulk)', () => {
    it('sends lineNumber + messageText + mobiles', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ status: 1, message: 'موفق', data: { packId: 'p', messageIds: [9] } }),
      );
      const driver = makeDriver();

      await driver.sendText('09121234567', 'پرداخت موفق بود');

      const { url, body } = lastCall();
      expect(url).toBe('https://api.sms.ir/v1/send/bulk');
      expect(body).toEqual({
        lineNumber: 1000500000,
        messageText: 'پرداخت موفق بود',
        mobiles: ['09121234567'],
      });
    });

    it('fails fast when SMS_IR_LINE_NUMBER is missing', async () => {
      const driver = makeDriver({ 'sms.lineNumber': undefined });

      await expect(driver.sendText('09121234567', 'متن')).rejects.toThrow(
        'SMS_IR_LINE_NUMBER is missing',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

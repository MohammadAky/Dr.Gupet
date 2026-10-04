import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/errors';
import { requestData, setAuthBridge } from './client';

vi.mock('../lib/env', () => ({ API_BASE_URL: 'http://localhost:3000/api/v1' }));

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthBridge(null);
});

describe('API response envelope', () => {
  it('omits browser cookies while preserving Bearer auth across a 401 refresh', async () => {
    let accessToken = 'old-access';
    const refresh = vi.fn(async () => {
      accessToken = 'new-access';
      return true;
    });
    setAuthBridge({ getAccessToken: () => accessToken, refresh });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { id: 1 } }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestData<{ id: number }>('/users/me')).resolves.toEqual({ id: 1 });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'omit',
      headers: { Authorization: 'Bearer old-access' },
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      credentials: 'omit',
      headers: { Authorization: 'Bearer new-access' },
    });
  });

  it('returns data from a valid success envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { status: 'ok' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(requestData<{ status: string }>('/health', { auth: false })).resolves.toEqual({
      status: 'ok',
    });
  });

  it('rejects malformed successful responses instead of silently returning undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>proxy error</html>', { status: 200 })),
    );

    await expect(requestData('/health', { auth: false })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_RESPONSE',
      statusCode: 200,
    } satisfies Partial<ApiError>);
  });

  it('accepts a no-content response for endpoints with no result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(
      requestData<void>('/pets/1', { method: 'DELETE', auth: false }),
    ).resolves.toBeUndefined();
  });
});

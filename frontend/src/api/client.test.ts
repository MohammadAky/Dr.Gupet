import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/errors';
import { requestData, setAuthBridge } from './client';

const env = vi.hoisted(() => ({ API_BASE_URL: 'http://localhost:3000/api/v1' }));
vi.mock('../lib/env', () => env);

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthBridge(null);
  env.API_BASE_URL = 'http://localhost:3000/api/v1';
});

describe('API deployment URL resolution', () => {
  it('resolves a root-relative API on the current origin with encoded queries and Bearer auth', async () => {
    env.API_BASE_URL = '/api/v1';
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:8080' } });
    setAuthBridge({ getAccessToken: () => 'local-access', refresh: vi.fn() });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestData('/products', {
      query: { q: 'رویال & گربه', page: 2, active: false, empty: '', missing: undefined, absent: null },
    });

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(url.origin).toBe('http://127.0.0.1:8080');
    expect(url.pathname).toBe('/api/v1/products');
    expect([...url.searchParams.entries()]).toEqual([
      ['q', 'رویال & گربه'], ['page', '2'], ['active', 'false'],
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'omit', headers: { Authorization: 'Bearer local-access' },
    });
  });

  it('keeps public requests on the same HTTPS origin without attaching auth or cookies', async () => {
    env.API_BASE_URL = '/api/v1';
    vi.stubGlobal('window', { location: { origin: 'https://drgupet.example' } });
    setAuthBridge({ getAccessToken: () => 'private-access', refresh: vi.fn() });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestData('/clinics', { auth: false });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://drgupet.example/api/v1/clinics');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit' });
    expect(fetchMock.mock.calls[0]?.[1].headers).not.toHaveProperty('Authorization');
  });

  it.each(['//other.example/api/v1', '/\\other.example/api/v1'])(
    'rejects an unsafe relative base %s before making a request', async (base) => {
      env.API_BASE_URL = base;
      vi.stubGlobal('window', { location: { origin: 'https://drgupet.example' } });
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(requestData('/users/me')).rejects.toThrow('Invalid root-relative API base URL');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('preserves the absolute development API without a browser global', async () => {
    vi.stubGlobal('window', undefined);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestData('/products', { query: { q: 'رویال' }, auth: false });

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(url.origin).toBe('http://localhost:3000');
    expect(url.pathname).toBe('/api/v1/products');
    expect(url.searchParams.get('q')).toBe('رویال');
  });
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

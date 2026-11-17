import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, setTokenProvider, request } from './http';

// Reset module state between tests
beforeEach(() => {
  setTokenProvider(null);
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  const responseHeaders = new Headers({ 'Content-Type': 'application/json', ...headers });
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: responseHeaders,
    }) as Response
  );
}

function mockFetchText(status: number, text: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(text, {
      status,
      headers: new Headers({ 'Content-Type': 'text/plain' }),
    }) as Response
  );
}

describe('request()', () => {
  it('returns parsed body on 200', async () => {
    mockFetch(200, { id: 1 });
    const result = await request('/rooms/1');
    expect(result).toEqual({ id: 1 });
  });

  it('returns undefined on 204', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 }) as Response
    );
    const result = await request('/rooms/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws ApiError with status 409 and detail from JSON body', async () => {
    mockFetch(409, { detail: 'Phòng đã được đặt' });
    await expect(request('/bookings/')).rejects.toMatchObject({
      status: 409,
      detail: 'Phòng đã được đặt',
    });
  });

  it('throws ApiError with statusText when error body is not JSON', async () => {
    mockFetchText(500, 'Internal Server Error');
    await expect(request('/bookings/')).rejects.toMatchObject({
      status: 500,
    });
  });

  it('maps fetch TypeError to ApiError with status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(request('/bookings/')).rejects.toMatchObject({ status: 0 });
  });

  it('skips undefined query params', async () => {
    mockFetch(200, { items: [] });
    await request('/rooms/', { params: { status: 'AVAILABLE', limit: undefined } });
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('status=AVAILABLE');
    expect(url).not.toContain('limit=');
  });

  it('repeats array query params', async () => {
    mockFetch(200, { items: [] });
    await request('/rooms/', { params: { equipment: ['TV', 'Camera'] } });
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('equipment=TV');
    expect(url).toContain('equipment=Camera');
  });

  it('sets Authorization header when provider returns a token', async () => {
    setTokenProvider(async () => 'test-token-abc');
    mockFetch(200, {});
    await request('/rooms/');
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token-abc');
  });

  it('omits Authorization header when provider returns null', async () => {
    setTokenProvider(async () => null);
    mockFetch(200, {});
    await request('/rooms/');
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('sets a unique X-Request-ID per call', async () => {
    mockFetch(200, {});
    mockFetch(200, {});
    await request('/rooms/');
    await request('/rooms/');
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const id1 = (calls[0][1] as RequestInit).headers as Record<string, string>;
    const id2 = (calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(id1['X-Request-ID']).toBeTruthy();
    expect(id2['X-Request-ID']).toBeTruthy();
    expect(id1['X-Request-ID']).not.toBe(id2['X-Request-ID']);
  });

  it('on 401 refreshes token with force and retries once', async () => {
    let callCount = 0;
    setTokenProvider(async (opts) => {
      callCount++;
      return opts?.force ? 'new-token' : 'old-token';
    });
    // First call → 401, second call (retry) → 200
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }) as Response)
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }) as Response);

    const result = await request('/rooms/1');
    expect(result).toEqual({ id: 1 });
    expect(callCount).toBe(2); // initial + force refresh
    const retryInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>)['Authorization']).toBe('Bearer new-token');
  });

  it('on second consecutive 401 throws ApiError 401', async () => {
    setTokenProvider(async () => 'token');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }) as Response)
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }) as Response);

    await expect(request('/rooms/1')).rejects.toMatchObject({ status: 401 });
  });
});

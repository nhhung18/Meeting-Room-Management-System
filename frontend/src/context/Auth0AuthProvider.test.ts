import { describe, test, expect, vi } from 'vitest';
import { createAuth0TokenProvider } from './Auth0AuthProvider';

describe('createAuth0TokenProvider', () => {
  test('calls getAccessTokenSilently with cache-first by default', async () => {
    const mockGetToken = vi.fn().mockResolvedValue('test-jwt-token');
    const provider = createAuth0TokenProvider(mockGetToken);
    const token = await provider();
    expect(mockGetToken).toHaveBeenCalledWith({ cacheMode: 'cache-first' });
    expect(token).toBe('test-jwt-token');
  });

  test('calls getAccessTokenSilently with cache off when force=true', async () => {
    const mockGetToken = vi.fn().mockResolvedValue('fresh-jwt-token');
    const provider = createAuth0TokenProvider(mockGetToken);
    const token = await provider({ force: true });
    expect(mockGetToken).toHaveBeenCalledWith({ cacheMode: 'off' });
    expect(token).toBe('fresh-jwt-token');
  });

  test('returns null when getAccessTokenSilently throws', async () => {
    const mockGetToken = vi.fn().mockRejectedValue(new Error('Login required'));
    const provider = createAuth0TokenProvider(mockGetToken);
    const token = await provider();
    expect(token).toBeNull();
  });
});

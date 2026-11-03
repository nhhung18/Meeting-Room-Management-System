import { describe, test, expect } from 'vitest';
import { createTokenProvider } from './AuthContext';

describe('createTokenProvider', () => {
  test('returns null in mock mode (no real JWT)', async () => {
    const provider = createTokenProvider();
    const token = await provider();
    expect(token).toBeNull();
  });

  test('returns null even when force=true (mock mode has no refresh)', async () => {
    const provider = createTokenProvider();
    const token = await provider({ force: true });
    expect(token).toBeNull();
  });
});

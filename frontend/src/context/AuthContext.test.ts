import { describe, test, expect } from 'vitest';
import { createTokenProvider, isAuth0Mode } from './authContextDef';

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

describe('isAuth0Mode', () => {
  test('returns false when VITE_AUTH0_DOMAIN is empty', () => {
    expect(isAuth0Mode('', '', '')).toBe(false);
  });

  test('returns false when any required var is missing', () => {
    expect(isAuth0Mode('dev.auth0.com', '', 'https://mrms.api')).toBe(false);
  });

  test('returns true when all three vars are set', () => {
    expect(isAuth0Mode('dev.auth0.com', 'abc123', 'https://mrms.api')).toBe(true);
  });
});

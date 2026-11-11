import { describe, test, expect } from 'vitest';
import { getErrorConfig } from './ApiErrorState';
import type { Translations } from '../context/LanguageContext';

const t = {
  errNetworkTitle: 'Không kết nối được máy chủ',
  errNetworkHint: 'Vui lòng kiểm tra mạng và thử lại',
  errForbiddenTitle: 'Bạn không có quyền xem nội dung này',
  errNotFoundTitle: 'Không tìm thấy dữ liệu',
  errRetryBtn: 'Thử lại',
  errGenericTitle: 'Đã xảy ra lỗi',
  errUnauthorizedTitle: 'Phiên đăng nhập hết hạn',
  errUnauthorizedHint: 'Token xác thực hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.',
} as unknown as Translations;

describe('getErrorConfig', () => {
  test('status 0 returns network error title with showRetry true', () => {
    const cfg = getErrorConfig(0, '', t);
    expect(cfg.title).toBe(t.errNetworkTitle);
    expect(cfg.description).toBe(t.errNetworkHint);
    expect(cfg.showRetry).toBe(true);
  });

  test('status undefined treated as network error', () => {
    const cfg = getErrorConfig(undefined, '', t);
    expect(cfg.title).toBe(t.errNetworkTitle);
    expect(cfg.showRetry).toBe(true);
  });

  test('status 403 returns forbidden title with showRetry false', () => {
    const cfg = getErrorConfig(403, 'Forbidden', t);
    expect(cfg.title).toBe(t.errForbiddenTitle);
    expect(cfg.showRetry).toBe(false);
    expect(cfg.statusType).toBe('403');
  });

  test('status 404 returns not-found title with showRetry false', () => {
    const cfg = getErrorConfig(404, 'Room not found', t);
    expect(cfg.title).toBe(t.errNotFoundTitle);
    expect(cfg.showRetry).toBe(false);
    expect(cfg.statusType).toBe('404');
  });

  test('status 409 returns server detail as title with showRetry false', () => {
    const cfg = getErrorConfig(409, 'Phòng đã được đặt trong khung giờ này', t);
    expect(cfg.title).toBe('Phòng đã được đặt trong khung giờ này');
    expect(cfg.showRetry).toBe(false);
    expect(cfg.statusType).toBe('warning');
  });

  test('status 409 without detail falls back to generic title', () => {
    const cfg = getErrorConfig(409, undefined, t);
    expect(cfg.title).toBe(t.errGenericTitle);
  });

  test('unknown status returns detail or generic title with showRetry true', () => {
    const cfg = getErrorConfig(500, 'Internal server error', t);
    expect(cfg.title).toBe('Internal server error');
    expect(cfg.showRetry).toBe(true);
    expect(cfg.statusType).toBe('error');
  });

  test('unknown status without detail falls back to generic title', () => {
    const cfg = getErrorConfig(500, '', t);
    expect(cfg.title).toBe(t.errGenericTitle);
    expect(cfg.showRetry).toBe(true);
  });

  test('status 401 returns unauthorized title and no retry', () => {
    const cfg = getErrorConfig(401, undefined, t);
    expect(cfg.title).toBe(t.errUnauthorizedTitle);
    expect(cfg.showRetry).toBe(false);
  });

  test('status 401 with detail still returns unauthorized title (not detail)', () => {
    const cfg = getErrorConfig(401, 'Token expired', t);
    expect(cfg.title).toBe(t.errUnauthorizedTitle);
    expect(cfg.description).toBe(t.errUnauthorizedHint);
    expect(cfg.showRetry).toBe(false);
  });
});

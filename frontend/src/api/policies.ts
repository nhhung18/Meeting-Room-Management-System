import { request } from './http';
import type { BookingPolicyConfig } from '../types';

interface BackendPolicyConfig {
  max_advance_days: number;
  max_duration_minutes: number;
  min_duration_minutes: number;
  enable_auto_release_no_show: boolean;
  auto_release_grace_minutes: number;
  buffer_minutes_between_meetings: number;
  min_cancel_notice_minutes: number;
  check_in_window_minutes: number;
  updated_at: string;
  updated_by: string | null;
}

function adaptConfig(raw: BackendPolicyConfig): BookingPolicyConfig {
  return {
    ...raw,
    updated_by_name: raw.updated_by ?? 'System',
  };
}

export async function getBookingPolicies(): Promise<BookingPolicyConfig> {
  const raw = await request<BackendPolicyConfig>('/bookings/policies/config');
  return adaptConfig(raw);
}

export async function updateBookingPolicies(
  data: Partial<BookingPolicyConfig>
): Promise<BookingPolicyConfig> {
  // Strip display-only fields before sending to backend
  const { updated_by_name: _, updated_at: __, ...payload } = data as BookingPolicyConfig;
  const raw = await request<BackendPolicyConfig>('/bookings/policies/config', {
    method: 'PATCH',
    body: payload,
  });
  return adaptConfig(raw);
}

export async function resetBookingPolicies(): Promise<BookingPolicyConfig> {
  const raw = await request<BackendPolicyConfig>('/bookings/policies/config', {
    method: 'PATCH',
    body: {
      max_advance_days: 14,
      max_duration_minutes: 180,
      min_duration_minutes: 15,
      enable_auto_release_no_show: true,
      auto_release_grace_minutes: 15,
      buffer_minutes_between_meetings: 0,
      min_cancel_notice_minutes: 30,
      check_in_window_minutes: 15,
    },
  });
  return adaptConfig(raw);
}

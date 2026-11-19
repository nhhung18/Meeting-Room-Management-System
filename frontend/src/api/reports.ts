import { request } from './http';

export interface RoomStatItem {
  room_id: number;
  room_name: string;
  total: number;
}

export interface DailyStatItem {
  date: string; // YYYY-MM-DD
  total: number;
  checked_in: number;
  cancelled: number;
}

export interface PeakHourItem {
  hour: number;
  total: number;
}

export interface ReportStatsResponse {
  total: number;
  confirmed: number;
  checked_in: number;
  cancelled: number;
  on_time_rate: number;
  cancel_rate: number;
  top_rooms: RoomStatItem[];
  daily_stats: DailyStatItem[];
  peak_hours: PeakHourItem[];
}

export async function getReportStats(
  startDate: string,
  endDate: string
): Promise<ReportStatsResponse> {
  return request<ReportStatsResponse>('/bookings/reports/stats', {
    params: { start_date: startDate, end_date: endDate },
  });
}

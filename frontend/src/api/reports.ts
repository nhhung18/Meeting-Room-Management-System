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

export interface MonthlyStatItem {
  month: string; // YYYY-MM
  total: number;
  checked_in: number;
  cancelled: number;
}

export interface RoomUtilisationItem {
  room_id: number;
  room_name: string;
  bookings: number;
  hours_booked: number;
  utilisation_rate: number; // % — giờ đặt / giờ khả dụng (08:00–18:00), tối đa 100
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
  auto_cancelled: number; // no-show: hệ thống tự hủy vì không check-in
  on_time_rate: number;
  cancel_rate: number;
  top_rooms: RoomStatItem[];
  daily_stats: DailyStatItem[];
  monthly_stats: MonthlyStatItem[];
  room_utilisation: RoomUtilisationItem[];
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

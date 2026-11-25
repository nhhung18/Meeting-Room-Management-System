import { describe, it, expect } from 'vitest';
import { getDashboardWidgets } from './dashboardLayout';

const EQUIPMENT_WIDGETS = ['kpi.equipment', 'stats.equipment'] as const;

describe.each(['ROOM_MANAGER', 'ADMINISTRATOR'] as const)('%s', (role) => {
  it('không có widget nào xuất hiện hai lần', () => {
    const w = getDashboardWidgets(role);
    expect(new Set(w).size).toBe(w.length);
  });

  it('thiết bị hiện đúng một lần', () => {
    const w = getDashboardWidgets(role);
    expect(w.filter((x) => EQUIPMENT_WIDGETS.includes(x as typeof EQUIPMENT_WIDGETS[number]))).toHaveLength(1);
  });
});

it('manager không có widget admin', () => {
  expect(getDashboardWidgets('ROOM_MANAGER').some((x) => x.startsWith('admin.'))).toBe(false);
});

it('admin không có kpi.equipment (đã chuyển xuống Row 3)', () => {
  expect(getDashboardWidgets('ADMINISTRATOR')).not.toContain('kpi.equipment');
});

it('role EMPLOYEE trả danh sách rỗng', () => {
  expect(getDashboardWidgets('EMPLOYEE')).toEqual([]);
});

it('role undefined trả danh sách rỗng', () => {
  expect(getDashboardWidgets(undefined)).toEqual([]);
});

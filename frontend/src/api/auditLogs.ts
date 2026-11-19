import { request } from './http';
import type { AuditLogEntry, AuditActionType } from '../types';

export interface AuditLogFilters {
  q?: string;
  actionType?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface BackendAuditLog {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_name: string | null;
  actor_role: string | null;
  action_type: string;
  target_id: string | null;
  target_name: string | null;
  details: string | null;
  ip_address: string | null;
}

function adaptLog(raw: BackendAuditLog): AuditLogEntry {
  return {
    id: raw.id,
    timestamp: raw.timestamp,
    actor_id: raw.actor_id,
    actor_name: raw.actor_name ?? raw.actor_id,
    actor_role: (raw.actor_role ?? 'EMPLOYEE') as AuditLogEntry['actor_role'],
    action_type: raw.action_type as AuditActionType,
    target_id: raw.target_id ?? undefined,
    target_name: raw.target_name ?? undefined,
    details: raw.details ?? '',
    ip_address: raw.ip_address ?? undefined,
  };
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.actionType && filters.actionType !== 'ALL') params.action_type = filters.actionType;
  if (filters.actorId && filters.actorId !== 'ALL') params.actor_id = filters.actorId;
  if (filters.startDate) params.start_date = filters.startDate;
  if (filters.endDate) params.end_date = filters.endDate;
  if (filters.limit !== undefined) params.limit = String(filters.limit);
  if (filters.offset !== undefined) params.offset = String(filters.offset);

  const resp = await request<{ items: BackendAuditLog[]; total: number }>(
    '/bookings/audit-logs/',
    { params }
  );
  return resp.items.map(adaptLog);
}

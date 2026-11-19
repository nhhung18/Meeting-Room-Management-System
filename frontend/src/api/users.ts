import { request } from './http';
import type { UserAccount, UserRole } from '../types';

interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  department: string | null;
  phone: string | null;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

function adaptUser(raw: BackendUser): UserAccount {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role as UserRole,
    status: raw.status as 'ACTIVE' | 'SUSPENDED',
    department: raw.department ?? '',
    phone: raw.phone ?? undefined,
    avatar: raw.avatar ?? undefined,
    created_at: raw.created_at,
  };
}

export interface UserFilterParams {
  q?: string;
  role?: UserRole | 'ALL';
  status?: 'ACTIVE' | 'SUSPENDED' | 'ALL';
  department?: string;
}

export async function getUserAccounts(params: UserFilterParams = {}): Promise<UserAccount[]> {
  const qp: Record<string, string | undefined> = {};
  if (params.q) qp.q = params.q;
  if (params.role && params.role !== 'ALL') qp.role = params.role;
  if (params.status && params.status !== 'ALL') qp.status = params.status;
  if (params.department && params.department !== 'ALL') qp.department = params.department;

  const resp = await request<{ items: BackendUser[]; total: number }>('/bookings/users/', {
    params: qp,
  });
  return resp.items.map(adaptUser);
}

export async function createUserAccount(
  data: Omit<UserAccount, 'created_at'>
): Promise<UserAccount> {
  const raw = await request<BackendUser>('/bookings/users/', {
    method: 'POST',
    body: {
      id: data.id || `local_${Date.now()}`,
      email: data.email,
      name: data.name,
      role: data.role,
      status: data.status,
      department: data.department || null,
      phone: data.phone || null,
      avatar: data.avatar || null,
    },
  });
  return adaptUser(raw);
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<UserAccount> {
  const raw = await request<BackendUser>(`/bookings/users/${userId}`, {
    method: 'PATCH',
    body: { role: newRole },
  });
  return adaptUser(raw);
}

export async function toggleUserStatus(userId: string, currentStatus: 'ACTIVE' | 'SUSPENDED'): Promise<UserAccount> {
  const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  const raw = await request<BackendUser>(`/bookings/users/${userId}`, {
    method: 'PATCH',
    body: { status: newStatus },
  });
  return adaptUser(raw);
}

export async function updateUserProfile(userId: string, data: Partial<UserAccount>): Promise<UserAccount> {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.department !== undefined) body.department = data.department;
  if (data.phone !== undefined) body.phone = data.phone;
  if (data.avatar !== undefined) body.avatar = data.avatar;

  const raw = await request<BackendUser>(`/bookings/users/${userId}`, {
    method: 'PATCH',
    body,
  });
  return adaptUser(raw);
}

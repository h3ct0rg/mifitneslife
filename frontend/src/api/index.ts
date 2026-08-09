import { api } from './client'
import type {
  AdminDashboardDto,
  AuthResponse,
  InviteRequest,
  InviteResponse,
  TenantActivityDto,
  TenantDto,
  UserListItem,
  UserDto,
} from './types'

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),
  googleLogin: (idToken: string) =>
    api.post<AuthResponse>('/auth/google-login', { idToken }).then((r) => r.data),
  register: (payload: {
    firstName: string
    lastName: string
    email: string
    password: string
    invitationToken?: string
  }) => api.post<AuthResponse>('/auth/register', payload).then((r) => r.data),
  me: () => api.get<UserDto>('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout').then(() => undefined),
}

export const usersApi = {
  list: () => api.get<UserListItem[]>('/users').then((r) => r.data),
  invite: (payload: InviteRequest) =>
    api.post<InviteResponse>('/users/invite', payload).then((r) => r.data),
  updateRole: (userId: string, role: number) =>
    api.put('/users/role', { userId, role }).then(() => undefined),
  getRoles: () => api.get<{ value: number; name: string }[]>('/users/roles').then((r) => r.data),
}

export const adminApi = {
  dashboard: () => api.get<AdminDashboardDto>('/admin/dashboard').then((r) => r.data),
  tenants: () => api.get<TenantDto[]>('/admin/tenants').then((r) => r.data),
  createTenant: (name: string, description?: string) =>
    api.post<TenantDto>('/admin/tenants', { name, description }).then((r) => r.data),
  tenantActivity: (tenantId: string) =>
    api.get<TenantActivityDto[]>(`/admin/tenants/${tenantId}/activity`).then((r) => r.data),
}
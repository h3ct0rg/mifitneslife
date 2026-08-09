import { api } from './client'
import type {
  AdminDashboardDto,
  AuthResponse,
  CreateMeasurementRequest,
  InviteRequest,
  InviteResponse,
  MeasurementDashboardDto,
  MeasurementDto,
  PagedResult,
  PatientDto,
  CreatePatientRequest,
  UpdatePatientRequest,
  UpdateMeasurementRequest,
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

export const patientsApi = {
  list: (params: { search?: string; page?: number; pageSize?: number }) =>
    api.get<PagedResult<PatientDto>>('/patients', { params }).then((r) => r.data),
  getById: (id: string) => api.get<PatientDto>(`/patients/${id}`).then((r) => r.data),
  create: (payload: CreatePatientRequest) =>
    api.post<PatientDto>('/patients', payload).then((r) => r.data),
  update: (id: string, payload: UpdatePatientRequest) =>
    api.put<PatientDto>(`/patients/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/patients/${id}`).then(() => undefined),
}

export const measurementsApi = {
  list: (patientId: string, params: { page?: number; pageSize?: number }) =>
    api.get<PagedResult<MeasurementDto>>(`/patients/${patientId}/measurements`, { params }).then((r) => r.data),
  getById: (patientId: string, id: string) =>
    api.get<MeasurementDto>(`/patients/${patientId}/measurements/${id}`).then((r) => r.data),
  dashboard: (patientId: string) =>
    api.get<MeasurementDashboardDto>(`/patients/${patientId}/measurements/dashboard`).then((r) => r.data),
  create: (patientId: string, payload: CreateMeasurementRequest) =>
    api.post<MeasurementDto>(`/patients/${patientId}/measurements`, payload).then((r) => r.data),
  update: (patientId: string, id: string, payload: UpdateMeasurementRequest) =>
    api.put<MeasurementDto>(`/patients/${patientId}/measurements/${id}`, payload).then((r) => r.data),
  remove: (patientId: string, id: string) =>
    api.delete(`/patients/${patientId}/measurements/${id}`).then(() => undefined),
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ fileName: string }>('/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.fileName
}

export async function getImageUrl(fileName: string): Promise<string> {
  const { data } = await api.get(`/uploads/${fileName}`, { responseType: 'blob' })
  return URL.createObjectURL(data)
}
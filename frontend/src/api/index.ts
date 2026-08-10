import { api } from './client'
import type {
  AdminDashboardDto,
  AppointmentDto,
  AuthResponse,
  CreateAppointmentRequest,
  CreateDietRequest,
  CreateFoodRequest,
  CreateMeasurementRequest,
  CreatePatientRequest,
  DietDto,
  ExerciseDto,
  FoodDto,
  CreateExerciseRequest,
  CreateWorkoutPlanRequest,
  UpdateExerciseRequest,
  UpdateWorkoutPlanRequest,
  WorkoutPlanDto,
  InviteRequest,
  InviteResponse,
  MeasurementDashboardDto,
  MeasurementDto,
  PatientDto,
  PatientDietDto,
  PatientPhotoDto,
  PagedResult,
  ProfessionalDto,
  TenantActivityDto,
  TenantDto,
  UpdateAppointmentRequest,
  UpdateDietRequest,
  UpdateFoodRequest,
  UpdateMeasurementRequest,
  UpdatePatientRequest,
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

export const appointmentsApi = {
  list: (params: { from: string; to: string }) =>
    api.get<AppointmentDto[]>('/appointments', { params }).then((r) => r.data),
  professionals: () => api.get<ProfessionalDto[]>('/appointments/professionals').then((r) => r.data),
  create: (payload: CreateAppointmentRequest) =>
    api.post<AppointmentDto>('/appointments', payload).then((r) => r.data),
  update: (id: string, payload: UpdateAppointmentRequest) =>
    api.put<AppointmentDto>(`/appointments/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/appointments/${id}`).then(() => undefined),
}

export const foodsApi = {
  list: (params: { search?: string; category?: string; page?: number; pageSize?: number }) =>
    api.get<PagedResult<FoodDto>>('/foods', { params }).then((r) => r.data),
  categories: () => api.get<string[]>('/foods/categories').then((r) => r.data),
  getById: (id: string) => api.get<FoodDto>(`/foods/${id}`).then((r) => r.data),
  create: (payload: CreateFoodRequest) =>
    api.post<FoodDto>('/foods', payload).then((r) => r.data),
  update: (id: string, payload: UpdateFoodRequest) =>
    api.put<FoodDto>(`/foods/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/foods/${id}`).then(() => undefined),
}

export const dietsApi = {
  list: () => api.get<DietDto[]>('/diets').then((r) => r.data),
  getById: (id: string) => api.get<DietDto>(`/diets/${id}`).then((r) => r.data),
  getByPatient: (patientId: string) =>
    api.get<{ assigned: boolean; diet: DietDto | null }>(`/diets/patient/${patientId}`).then((r) => r.data),
  getHistoryByPatient: (patientId: string) =>
    api.get<PatientDietDto[]>(`/diets/patient/${patientId}/history`).then((r) => r.data),
  assign: (patientId: string, dietId?: string) =>
    api.put<DietDto | null>('/diets/assign', { patientId, dietId: dietId || null }).then((r) => r.data),
  create: (payload: CreateDietRequest) =>
    api.post<DietDto>('/diets', payload).then((r) => r.data),
  update: (id: string, payload: UpdateDietRequest) =>
    api.put<DietDto>(`/diets/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/diets/${id}`).then(() => undefined),
}

export const exercisesApi = {
  list: (params: { search?: string; category?: string; equipment?: string; page?: number; pageSize?: number }) =>
    api.get<PagedResult<ExerciseDto>>('/exercises', { params }).then((r) => r.data),
  categories: () => api.get<string[]>('/exercises/categories').then((r) => r.data),
  equipment: () => api.get<string[]>('/exercises/equipment').then((r) => r.data),
  getById: (id: string) => api.get<ExerciseDto>(`/exercises/${id}`).then((r) => r.data),
  create: (payload: CreateExerciseRequest) =>
    api.post<ExerciseDto>('/exercises', payload).then((r) => r.data),
  update: (id: string, payload: UpdateExerciseRequest) =>
    api.put<ExerciseDto>(`/exercises/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/exercises/${id}`).then(() => undefined),
}

export const workoutPlansApi = {
  list: () => api.get<WorkoutPlanDto[]>('/workout-plans').then((r) => r.data),
  getById: (id: string) => api.get<WorkoutPlanDto>(`/workout-plans/${id}`).then((r) => r.data),
  getByPatient: (patientId: string) =>
    api.get<{ assigned: boolean; plan: WorkoutPlanDto | null }>(`/workout-plans/patient/${patientId}`).then((r) => r.data),
  create: (payload: CreateWorkoutPlanRequest) =>
    api.post<WorkoutPlanDto>('/workout-plans', payload).then((r) => r.data),
  update: (id: string, payload: UpdateWorkoutPlanRequest) =>
    api.put<WorkoutPlanDto>(`/workout-plans/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/workout-plans/${id}`).then(() => undefined),
}

export const patientPhotosApi = {
  list: (patientId: string) => api.get<PatientPhotoDto[]>(`/patients/${patientId}/photos`).then((r) => r.data),
  upload: (patientId: string, file: File, takenAt?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (takenAt) form.append('takenAt', takenAt)
    return api
      .post<PatientPhotoDto>(`/patients/${patientId}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  remove: (patientId: string, id: string) =>
    api.delete(`/patients/${patientId}/photos/${id}`).then(() => undefined),
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

export async function getExerciseImageUrl(fileName: string): Promise<string> {
  const { data } = await api.get(`/uploads/exercise-image/${fileName}`, { responseType: 'blob' })
  return URL.createObjectURL(data)
}

export async function getExerciseVideoUrl(fileName: string): Promise<string> {
  const { data } = await api.get(`/uploads/exercise-video/${fileName}`, { responseType: 'blob' })
  return URL.createObjectURL(data)
}
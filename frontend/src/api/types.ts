export interface UserDto {
  id: string
  firstName: string
  lastName: string
  email: string
  tenantId: string | null
  role: string
  status: string
  fullName: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: UserDto
}

export interface InviteRequest {
  email: string
  role: number
}

export interface InviteResponse {
  id: string
  email: string
  role: string
  status: string
  token: string
  expiresAt: string
}

export interface UserListItem {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  status: string
  tenantId: string | null
  lastLoginAt: string | null
}

export interface TenantDto {
  id: string
  name: string
  slug: string
  description?: string
  isActive: boolean
  userCount: number
  activeUsersLast30Days: number
  lastActivityAt?: string
  createdAt: string
}

export interface TenantActivityDto {
  tenantId: string
  tenantName: string
  timestamp: string
  action: string
  userEmail?: string
  entity: string
}

export interface AdminDashboardDto {
  totalTenants: number
  activeTenants: number
  totalUsers: number
  activeUsers: number
  tenants: TenantDto[]
  recentActivity: TenantActivityDto[]
}

export const ROLES: Record<number, string> = {
  0: 'SuperAdmin',
  1: 'Admin',
  2: 'Nutritionist',
  3: 'Trainer',
  4: 'Patient',
}

export interface PatientDto {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone?: string
  dateOfBirth?: string
  profilePhotoUrl?: string
  notes?: string
  status: string
  createdAt: string
}

export interface PagedResult<T> {
  page: number
  pageSize: number
  total: number
  totalPages: number
  items: T[]
}

export interface CreatePatientRequest {
  firstName: string
  lastName: string
  email: string
  phone?: string
  dateOfBirth?: string
  profilePhotoUrl?: string
  notes?: string
}

export interface UpdatePatientRequest extends CreatePatientRequest {
  status: string
}

export interface MeasurementDto {
  id: string
  patientId: string
  visitDate: string
  weightKg?: number
  heightCm?: number
  bodyFatPct?: number
  muscleMassKg?: number
  boneMassKg?: number
  bodyWaterPct?: number
  basalMetabolism?: number
  chestCm?: number
  waistCm?: number
  hipCm?: number
  armCm?: number
  forearmCm?: number
  thighCm?: number
  calfCm?: number
  neckCm?: number
  heartRateBpm?: number
  systolicMmHg?: number
  diastolicMmHg?: number
  oxygenSaturationPct?: number
  respiratoryRate?: number
  temperatureC?: number
  notes?: string
  createdAt: string
  imc?: number
  imcRange: string
  waistHipRatio?: number
  waistHipRange: string
  iac?: number
  iacRange: string
}

export interface MeasurementIndexDto {
  imc?: number
  imcRange: string
  waistHipRatio?: number
  waistHipRange: string
  iac?: number
  iacRange: string
}

export interface MeasurementDeltaDto {
  label: string
  first?: number
  last?: number
  change?: number
  unit: string
}

export interface MeasurementSeriesPointDto {
  date: string
  value?: number
}

export interface MeasurementDashboardDto {
  latestIndexes?: MeasurementIndexDto
  weightSeries: MeasurementSeriesPointDto[]
  imcSeries: MeasurementSeriesPointDto[]
  bodyFatSeries: MeasurementSeriesPointDto[]
  waistSeries: MeasurementSeriesPointDto[]
  deltas: MeasurementDeltaDto[]
}

export interface CreateMeasurementRequest {
  visitDate: string
  weightKg?: number
  heightCm?: number
  bodyFatPct?: number
  muscleMassKg?: number
  boneMassKg?: number
  bodyWaterPct?: number
  basalMetabolism?: number
  chestCm?: number
  waistCm?: number
  hipCm?: number
  armCm?: number
  forearmCm?: number
  thighCm?: number
  calfCm?: number
  neckCm?: number
  heartRateBpm?: number
  systolicMmHg?: number
  diastolicMmHg?: number
  oxygenSaturationPct?: number
  respiratoryRate?: number
  temperatureC?: number
  notes?: string
}

export type UpdateMeasurementRequest = CreateMeasurementRequest
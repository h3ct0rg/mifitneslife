export interface UserDto {
  id: string
  firstName: string
  lastName: string
  email: string
  tenantId: string | null
  role: string
  status: string
  fullName: string
  /** Membresía actual (la del token). role/tenantId son los de esta membresía. */
  membershipId: string
  memberships: MembershipDto[]
  /** Suscripción del tenant de la membresía actual; null para SuperAdmin. */
  subscription?: UserSubscriptionDto | null
}

export type SubscriptionStatus = 'Active' | 'ExpiringSoon' | 'Expired' | 'None'

export interface UserSubscriptionDto {
  /** null con status `None` (tenant sin suscripción). */
  planName: string | null
  endsAt: string | null
  status: SubscriptionStatus
  daysLeft: number | null
}

/** Código del 403 que devuelve el backend cuando la suscripción del tenant venció. */
export const SUBSCRIPTION_EXPIRED_CODE = 'subscription_expired'

export interface MembershipDto {
  id: string
  tenantId: string | null
  tenantName: string | null
  role: string
  status: string
  lastUsedAt: string | null
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: UserDto
}

/** Respuesta de login/google-login cuando el usuario tiene >1 membresía activa. */
export interface MembershipSelectionResponse {
  requiresMembershipSelection: true
  selectionToken: string
  memberships: MembershipDto[]
}

export type LoginResult = AuthResponse | MembershipSelectionResponse

export function isMembershipSelection(res: LoginResult): res is MembershipSelectionResponse {
  return (res as MembershipSelectionResponse).requiresMembershipSelection === true
}

export interface CreateMembershipRequest {
  role: string
  tenantId?: string | null
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
  sentAt?: string
  attempts?: number
  lastError?: string
}

export interface InvitationDto {
  id: string
  email: string
  role: string
  status: string
  token: string
  expiresAt: string
  sentAt?: string
  acceptedAt?: string
  attempts: number
  lastError?: string
  expired: boolean
}

export interface InvitationInfoDto {
  valid: boolean
  email?: string
  role?: string
  tenantName?: string
  expiresAt?: string
  /** true si ya existe una cuenta con ese email → iniciar sesión y aceptar. */
  existingAccount?: boolean
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
  description?: string | null
  logoUrl?: string | null
  isActive: boolean
  createdAt: string
  userCount: number
  patientCount: number
  activeUsersLast30Days: number
  lastActivityAt?: string | null
  subscription?: SubscriptionSummaryDto | null
}

// ===== Planes y suscripciones (SuperAdmin) =====
export interface SubscriptionSummaryDto {
  planId: string
  planName: string
  startsAt: string
  endsAt: string
  status: SubscriptionStatus
  daysLeft: number
}

export interface PlanDto {
  id: string
  name: string
  durationDays: number
  priceUsd: number
  isTrial: boolean
  isActive: boolean
  sortOrder: number
  tenantsCount: number
}

export interface SavePlanRequest {
  name: string
  durationDays: number
  priceUsd: number
  isActive: boolean
  sortOrder: number
}

export interface TenantSubscriptionDto {
  id: string
  planId: string
  planName: string
  priceUsd: number
  startsAt: string
  endsAt: string
  createdAt: string
  createdByName: string | null
  note: string | null
}

export interface AssignSubscriptionRequest {
  planId: string
  note?: string
}

// ===== Conexiones (SuperAdmin) =====
export type ConnectionRole = 'admin' | 'doctor' | 'patient'

export interface ConnectionQuery {
  from: string
  to: string
  tenantId?: string
  role?: ConnectionRole
}

export interface ConnectionDailyDto {
  date: string
  uniqueUsers: number
  logins: number
}

export interface ConnectionSummaryDto {
  totalLogins: number
  uniqueUsers: number
  uniqueByRole: { admin: number; doctor: number; patient: number }
  daily: ConnectionDailyDto[]
}

export interface ConnectionDto {
  id: string
  occurredAt: string
  userId: string
  userName: string | null
  email: string | null
  tenantId: string | null
  tenantName: string | null
  role: string
  method: string
}

export interface CreateTenantRequest {
  name: string
  description?: string
  slug?: string
}

export interface UpdateTenantRequest {
  name: string
  description?: string
  isActive: boolean
}

export interface RegistrationMonthDto {
  month: string // "YYYY-MM"
  users: number
  tenants: number
  patients: number
}

export interface AdminUserDto {
  id: string
  email: string
  fullName: string
  role: string
  tenantId: string | null
  tenantName: string | null
  isActive: boolean
  createdAt: string
  lastLoginAt?: string | null
  /** role/tenant de arriba = membresía por defecto (compatibilidad). */
  memberships: MembershipDto[]
}

export interface AdminUserListDto {
  items: AdminUserDto[]
  total: number
  page: number
  pageSize: number
}

export interface AdminUserQuery {
  search?: string
  tenantId?: string
  role?: string
  page?: number
  pageSize?: number
}

export interface CreateAdminUserRequest {
  email: string
  fullName: string
  password: string
  role: string
  tenantId?: string | null
}

export interface UpdateAdminUserRequest {
  fullName: string
  isActive: boolean
}

export interface TenantDeleteImpactDto {
  tenantId: string
  name: string
  users: number
  patients: number
  appointments: number
  otherRecords: number
}

export interface UserDeleteImpactDto {
  userId: string
  email: string
  role: string
  tenantName: string | null
  patientProfile: boolean
  appointments: number
  otherRecords: number
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
  totalPatients: number
  usersByRole: Record<string, number>
  newUsersLast30Days: number
  newTenantsLast30Days: number
  newPatientsLast30Days: number
  registrationsByMonth: RegistrationMonthDto[]
  tenants: TenantDto[]
  recentActivity: TenantActivityDto[]
}

// ===== Dashboard de gestión (GET api/dashboard/kpis) =====
export interface AppointmentCountsDto {
  scheduled: number
  completed: number
  cancelled: number
  noShow: number
}

export interface DashboardKpisDto {
  scope: 'tenant' | 'professional'
  generatedAt: string
  patients: {
    total: number
    active: number
    newThisMonth: number
    newPrevMonth: number
    withDiet: number
    withWorkout: number
    withoutFollowUp30d: number
  }
  appointments: {
    today: number
    next7Days: number
    thisMonth: AppointmentCountsDto
    prevMonth: AppointmentCountsDto
    /** completed/(completed+noShow) este mes, 0..1; null si denominador 0. */
    attendanceRate: number | null
    /** cancelled/total este mes, 0..1; null si denominador 0. */
    cancellationRate: number | null
    /** noShow/(completed+noShow) este mes, 0..1; null si denominador 0. */
    noShowRate: number | null
  }
  /** Últimos 6 meses incl. actual, orden ascendente. */
  monthly: DashboardMonthDto[]
  /** Solo Admin; ordenado por completedThisMonth desc. */
  professionals: DashboardProfessionalDto[]
  atRiskPatients: DashboardAtRiskPatientDto[]
  todayAppointments: DashboardTodayAppointmentDto[]
}

export interface DashboardMonthDto {
  month: string // "YYYY-MM"
  newPatients: number
  completed: number
  cancelled: number
  noShow: number
  measurements: number
}

export interface DashboardProfessionalDto {
  id: string
  fullName: string
  role: string
  completedThisMonth: number
  upcoming: number
  patientsAttendedThisMonth: number
  noShowRate: number | null
}

export interface DashboardAtRiskPatientDto {
  id: string
  fullName: string
  lastActivityAt: string | null
  daysSinceActivity: number | null
}

export interface DashboardTodayAppointmentDto {
  id: string
  startAt: string
  patientId: string
  patientName: string
  professionalName: string
  status: AppointmentStatus
}

/** Roles en el orden en que se muestran en selectores del panel de plataforma. */
export const ROLE_KEYS = ['SuperAdmin', 'Admin', 'Nutritionist', 'Trainer', 'Patient'] as const

export const ROLES: Record<number, string> = {
  0: 'SuperAdmin',
  1: 'Admin',
  2: 'Nutritionist',
  3: 'Trainer',
  4: 'Patient',
}

export const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: 'Super Administrador',
  Admin: 'Administrador',
  Nutritionist: 'Nutricionista',
  Trainer: 'Entrenador',
  Patient: 'Paciente',
}

export function roleLabel(role?: string): string {
  if (!role) return '—'
  return ROLE_LABELS[role] ?? role
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
  /** Existe ApplicationUser con ese email en el tenant. */
  hasAccount: boolean
  /** Hay una invitación pendiente para ese email en el tenant. */
  pendingInvitation: boolean
}

/**
 * `already_member` = ya tiene esa misma membresía (tenant+rol); `failed` = falló la creación de la invitación;
 * `none` = sin email válido. `existing_user` se conserva por compatibilidad.
 */
export type PatientInvitationStatus = 'sent' | 'resent' | 'already_member' | 'failed' | 'existing_user' | 'none'

/** Respuesta de POST api/patients. */
export interface CreatePatientResponse extends PatientDto {
  invitationStatus: PatientInvitationStatus
}

/** Respuesta de POST api/patients/{id}/invite. */
export interface PatientInviteResponse {
  invitationStatus: PatientInvitationStatus
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

export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'NoShow'

export interface ProfessionalDto {
  id: string
  fullName: string
  email: string
  role: string
}

export interface AppointmentDto {
  id: string
  patientId: string
  patientFullName: string
  professionalId: string
  professionalFullName: string
  professionalRole: string
  dietId?: string
  dietName?: string
  startAt: string
  endAt?: string
  status: AppointmentStatus
  title?: string
  notes?: string
}

export interface CreateAppointmentRequest {
  patientId: string
  professionalId: string
  dietId?: string
  startAt: string
  endAt?: string
  title?: string
  notes?: string
}

export interface UpdateAppointmentRequest {
  patientId: string
  professionalId: string
  dietId?: string
  startAt: string
  endAt?: string
  title?: string
  notes?: string
  status?: AppointmentStatus
}

export interface FoodDto {
  id: string
  name: string
  category: string
  subcategory?: string
  description?: string
  unit: string
  defaultQuantity: number
  brand?: string
  code?: string
  status: string
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  potassium: number
  calcium: number
  iron: number
  cholesterol: number
}

export interface CreateFoodRequest {
  name: string
  category: string
  subcategory?: string
  description?: string
  unit: string
  defaultQuantity: number
  brand?: string
  code?: string
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  potassium: number
  calcium: number
  iron: number
  cholesterol: number
}

export interface UpdateFoodRequest extends CreateFoodRequest {
  status: string
}

export interface MealItemDto {
  id: string
  foodId: string
  foodName: string
  quantity: number
  unit: string
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  potassium: number
  cholesterol: number
  iron: number
  calcium: number
}

export interface MealDto {
  id: string
  name: string
  scheduledTime?: string
  instructions?: string
  sortOrder: number
  items: MealItemDto[]
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  potassium: number
  cholesterol: number
  iron: number
  calcium: number
}

export interface DietDto {
  id: string
  name: string
  patientId?: string
  patientName?: string
  objective?: string
  startDate?: string
  endDate?: string
  observations?: string
  status: string
  createdAt: string
  goalCalories?: number
  goalProtein?: number
  goalCarbs?: number
  goalFat?: number
  goalFiber?: number
  meals: MealDto[]
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  potassium: number
  cholesterol: number
  iron: number
  calcium: number
}

export interface MealItemRequest {
  foodId: string
  quantity: number
  unit: string
}

export interface MealRequest {
  name: string
  scheduledTime?: string
  instructions?: string
  items: MealItemRequest[]
}

export interface PatientDietDto {
  id: string
  dietId: string
  dietName: string
  objective?: string
  assignedAt: string
  isActive: boolean
}

export interface PatientPhotoDto {
  id: string
  patientId: string
  fileName: string
  takenAt: string
}

export interface ExerciseDto {
  id: string
  name: string
  category: string
  bodyPart: string
  equipment: string
  target?: string
  muscleGroup?: string
  secondaryMuscles?: string
  instructions?: string
  imageUrl?: string
  gifUrl?: string
  mediaId?: string
  status: string
}

export interface CreateExerciseRequest {
  name: string
  category: string
  bodyPart: string
  equipment: string
  target?: string
  muscleGroup?: string
  secondaryMuscles?: string
  instructions?: string
  imageUrl?: string
  gifUrl?: string
  mediaId?: string
}

export interface UpdateExerciseRequest extends CreateExerciseRequest {
  status: string
}

export interface WorkoutExerciseDto {
  id: string
  exerciseId: string
  exerciseName: string
  exerciseCategory: string
  exerciseEquipment: string
  exerciseGifUrl?: string
  sets?: number
  reps?: string
  restSeconds?: number
  notes?: string
  sortOrder: number
}

export interface WorkoutDayDto {
  id: string
  dayName: string
  notes?: string
  sortOrder: number
  exercises: WorkoutExerciseDto[]
}

export interface WorkoutPlanDto {
  id: string
  name: string
  patientId?: string
  patientName?: string
  objective?: string
  observations?: string
  status: string
  createdAt: string
  days: WorkoutDayDto[]
  totalExercises: number
}

export interface WorkoutExerciseRequest {
  exerciseId: string
  sets?: number
  reps?: string
  restSeconds?: number
  notes?: string
}

export interface WorkoutDayRequest {
  dayName: string
  notes?: string
  exercises: WorkoutExerciseRequest[]
}

export interface CreateWorkoutPlanRequest {
  name: string
  patientId?: string
  objective?: string
  observations?: string
  days: WorkoutDayRequest[]
}

export interface UpdateWorkoutPlanRequest extends CreateWorkoutPlanRequest {
  status: string
}

export interface CreateDietRequest {
  name: string
  patientId?: string
  objective?: string
  startDate?: string
  endDate?: string
  observations?: string
  goalCalories?: number
  goalProtein?: number
  goalCarbs?: number
  goalFat?: number
  goalFiber?: number
  meals: MealRequest[]
}

export interface UpdateDietRequest extends CreateDietRequest {
  status: string
}
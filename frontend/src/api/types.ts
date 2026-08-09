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
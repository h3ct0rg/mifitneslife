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
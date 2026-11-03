namespace MyFitnessLife.Application.DTOs.Admin;

public class TenantDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; }
    public int UserCount { get; set; }
    public int PatientCount { get; set; }
    public int ActiveUsersLast30Days { get; set; }
    public DateTime? LastActivityAt { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Suscripción vigente; null si el tenant no tiene ninguna (estado "None").</summary>
    public SubscriptionSummaryDto? Subscription { get; set; }
}

// ───────────── Planes y suscripciones ─────────────

public class PlanDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public decimal PriceUsd { get; set; }
    public bool IsTrial { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    /// <summary>Tenants cuya suscripción vigente es de este plan.</summary>
    public int TenantsCount { get; set; }
}

public class SavePlanRequest
{
    public string Name { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public decimal PriceUsd { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

public class SubscriptionSummaryDto
{
    public Guid? PlanId { get; set; }
    public string? PlanName { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    /// <summary>Active | ExpiringSoon | Expired | None.</summary>
    public string Status { get; set; } = string.Empty;
    public int DaysLeft { get; set; }
}

public class TenantSubscriptionDto
{
    public Guid Id { get; set; }
    public Guid PlanId { get; set; }
    public string PlanName { get; set; } = string.Empty;
    public decimal PriceUsd { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>null = sistema (alta del tenant / migración) o usuario ya eliminado.</summary>
    public string? CreatedByName { get; set; }
    public string? Note { get; set; }
}

public class AssignSubscriptionRequest
{
    public Guid PlanId { get; set; }
    public string? Note { get; set; }
}

// ───────────── Conexiones ─────────────

public class UniqueByRoleDto
{
    public int Admin { get; set; }
    /// <summary>Nutritionist + Trainer.</summary>
    public int Doctor { get; set; }
    public int Patient { get; set; }
}

public class DailyConnectionsDto
{
    /// <summary>Día en la zona del cliente (header X-Time-Zone), formato "yyyy-MM-dd".</summary>
    public string Date { get; set; } = string.Empty;
    public int UniqueUsers { get; set; }
    public int Logins { get; set; }
}

public class ConnectionsSummaryDto
{
    public int TotalLogins { get; set; }
    public int UniqueUsers { get; set; }
    public UniqueByRoleDto UniqueByRole { get; set; } = new();
    public IReadOnlyList<DailyConnectionsDto> Daily { get; set; } = [];
}

public class ConnectionDto
{
    public Guid Id { get; set; }
    public DateTime OccurredAt { get; set; }
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public Guid? TenantId { get; set; }
    public string? TenantName { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
}

public class CreateTenantRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Slug { get; set; }
}

public class UpdateTenantRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class TenantActivityDto
{
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public string Entity { get; set; } = string.Empty;
}

public class RegistrationsByMonthDto
{
    /// <summary>Mes en formato "YYYY-MM".</summary>
    public string Month { get; set; } = string.Empty;
    public int Users { get; set; }
    public int Tenants { get; set; }
    public int Patients { get; set; }
}

public class AdminDashboardDto
{
    public int TotalTenants { get; set; }
    public int ActiveTenants { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int TotalPatients { get; set; }
    public Dictionary<string, int> UsersByRole { get; set; } = new();
    public int NewUsersLast30Days { get; set; }
    public int NewTenantsLast30Days { get; set; }
    public int NewPatientsLast30Days { get; set; }
    public IEnumerable<RegistrationsByMonthDto> RegistrationsByMonth { get; set; } = [];
    public IEnumerable<TenantDto> Tenants { get; set; } = [];
    public IEnumerable<TenantActivityDto> RecentActivity { get; set; } = [];
}

public class AdminUserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public Guid? TenantId { get; set; }
    public string? TenantName { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public IReadOnlyList<MyFitnessLife.Application.DTOs.Auth.MembershipDto> Memberships { get; set; } = [];
}

public class CreateAdminUserRequest
{
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public Guid? TenantId { get; set; }
}

public class UpdateAdminUserRequest
{
    public string FullName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class TenantDeleteImpactDto
{
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Users { get; set; }
    public int Patients { get; set; }
    public int Appointments { get; set; }
    public int OtherRecords { get; set; }
}

public class UserDeleteImpactDto
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? TenantName { get; set; }
    public bool PatientProfile { get; set; }
    public int Appointments { get; set; }
    public int OtherRecords { get; set; }
}

public class AddMembershipRequest
{
    public string Role { get; set; } = string.Empty;
    public Guid? TenantId { get; set; }
}

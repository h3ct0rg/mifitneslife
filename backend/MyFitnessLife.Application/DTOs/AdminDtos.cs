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

public class AssignUserRequest
{
    public string Role { get; set; } = string.Empty;
    public Guid? TenantId { get; set; }
}

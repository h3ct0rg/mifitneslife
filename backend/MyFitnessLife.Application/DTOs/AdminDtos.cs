namespace MyFitnessLife.Application.DTOs.Admin;

public class TenantDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int UserCount { get; set; }
    public int ActiveUsersLast30Days { get; set; }
    public DateTime? LastActivityAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateTenantRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
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

public class AdminDashboardDto
{
    public int TotalTenants { get; set; }
    public int ActiveTenants { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public IEnumerable<TenantDto> Tenants { get; set; } = [];
    public IEnumerable<TenantActivityDto> RecentActivity { get; set; } = [];
}
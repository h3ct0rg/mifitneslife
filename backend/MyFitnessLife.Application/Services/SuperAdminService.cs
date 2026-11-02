using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class SuperAdminService : ISuperAdminService
{
    private readonly IUnitOfWork _unitOfWork;

    public SuperAdminService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<AdminDashboardDto> GetDashboardAsync()
    {
        var totalTenants = await _unitOfWork.Tenants.CountTotalAsync();
        var activeTenants = await _unitOfWork.Tenants.CountActiveAsync();
        var allUsers = await _unitOfWork.Users.GetByTenantAsync(Guid.Empty, includeDeleted: true);
        var tenants = await _unitOfWork.Tenants.GetWithRecentActivityAsync(30);

        var tenantDtos = new List<TenantDto>();
        foreach (var t in tenants)
        {
            tenantDtos.Add(new TenantDto
            {
                Id = t.Id,
                Name = t.Name,
                Slug = t.Slug,
                Description = t.Description,
                IsActive = t.IsActive,
                UserCount = await _unitOfWork.Users.CountByTenantAsync(t.Id),
                ActiveUsersLast30Days = await GetActiveByTenantAsync(t.Id),
                LastActivityAt = t.UpdatedAt,
                CreatedAt = t.CreatedAt
            });
        }

        var recent = await _unitOfWork.AuditLogs.GetRecentAsync(50);
        var activity = recent.Select(a => new TenantActivityDto
        {
            TenantId = a.TenantId ?? Guid.Empty,
            TenantName = tenantDtos.FirstOrDefault(t => t.Id == a.TenantId)?.Name ?? "Sistema",
            Timestamp = a.Timestamp,
            Action = a.Action,
            UserEmail = a.Details,
            Entity = a.Entity
        });

        return new AdminDashboardDto
        {
            TotalTenants = totalTenants,
            ActiveTenants = activeTenants,
            TotalUsers = allUsers.Count(),
            ActiveUsers = allUsers.Count(u => u.Status == MyFitnessLife.Domain.Enums.UserStatus.Active),
            Tenants = tenantDtos,
            RecentActivity = activity
        };
    }

    private async Task<int> GetActiveByTenantAsync(Guid tenantId)
    {
        var users = await _unitOfWork.Users.GetByTenantAsync(tenantId);
        var cutoff = DateTime.UtcNow.AddDays(-30);
        return users.Count(u => u.LastLoginAt.HasValue && u.LastLoginAt >= cutoff);
    }

    public async Task<IEnumerable<TenantDto>> GetTenantsAsync()
    {
        var tenants = await _unitOfWork.Tenants.GetAllAsync();
        var result = new List<TenantDto>();
        foreach (var t in tenants)
        {
            result.Add(new TenantDto
            {
                Id = t.Id,
                Name = t.Name,
                Slug = t.Slug,
                Description = t.Description,
                IsActive = t.IsActive,
                UserCount = await _unitOfWork.Users.CountByTenantAsync(t.Id),
                CreatedAt = t.CreatedAt,
                LastActivityAt = t.UpdatedAt
            });
        }
        return result;
    }

    public async Task<TenantDto> CreateTenantAsync(CreateTenantRequest request)
    {
        var slug = request.Name.Trim().ToLowerInvariant().Replace(" ", "-");
        if (await _unitOfWork.Tenants.GetBySlugAsync(slug) is not null)
            throw new InvalidOperationException("Ya existe un tenant con ese nombre.");

        var tenant = new MyFitnessLife.Domain.Entities.Tenant
        {
            Name = request.Name.Trim(),
            Slug = slug,
            Description = request.Description,
            IsActive = true
        };

        await _unitOfWork.Tenants.AddAsync(tenant);
        await _unitOfWork.SaveChangesAsync();

        return new TenantDto
        {
            Id = tenant.Id,
            Name = tenant.Name,
            Slug = tenant.Slug,
            Description = tenant.Description,
            IsActive = tenant.IsActive,
            UserCount = 0,
            CreatedAt = tenant.CreatedAt
        };
    }

    public async Task<IEnumerable<TenantActivityDto>> GetTenantActivityAsync(Guid tenantId)
    {
        var logs = await _unitOfWork.AuditLogs.GetByTenantAsync(tenantId, 100);
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId);

        return logs.Select(a => new TenantActivityDto
        {
            TenantId = tenantId,
            TenantName = tenant?.Name ?? "Desconocido",
            Timestamp = a.Timestamp,
            Action = a.Action,
            UserEmail = a.Details,
            Entity = a.Entity
        });
    }
}
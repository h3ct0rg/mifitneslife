using MyFitnessLife.Domain.Entities;

namespace MyFitnessLife.Domain.Interfaces;

public interface IUserRepository
{
    Task<ApplicationUser?> GetByIdAsync(Guid id);
    Task<ApplicationUser?> GetByEmailAsync(string email);
    Task<ApplicationUser?> GetByGoogleSubjectAsync(string subject);
    Task<IEnumerable<ApplicationUser>> GetByTenantAsync(Guid tenantId, bool includeDeleted = false);
    Task<int> CountByTenantAsync(Guid tenantId);
    Task AddAsync(ApplicationUser user);
    Task UpdateAsync(ApplicationUser user);
    Task<bool> EmailExistsAsync(string email);
}

public interface ITenantRepository
{
    Task<Tenant?> GetByIdAsync(Guid id);
    Task<Tenant?> GetBySlugAsync(string slug);
    Task<IEnumerable<Tenant>> GetAllAsync(bool includeInactive = true);
    Task<int> CountActiveUsersAsync(Guid tenantId);
    Task<int> CountTotalAsync();
    Task<int> CountActiveAsync();
    Task AddAsync(Tenant tenant);
    Task UpdateAsync(Tenant tenant);
    Task<IEnumerable<Tenant>> GetWithRecentActivityAsync(int days);
}

public interface IInvitationRepository
{
    Task<Invitation?> GetByIdAsync(Guid id);
    Task<Invitation?> GetByTokenAsync(string token);
    Task<Invitation?> GetPendingByEmailAsync(Guid tenantId, string email);
    Task<IEnumerable<Invitation>> GetByTenantAsync(Guid tenantId);
    Task AddAsync(Invitation invitation);
    Task UpdateAsync(Invitation invitation);
}

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenAsync(string token);
    Task AddAsync(RefreshToken token);
    Task UpdateAsync(RefreshToken token);
    Task RevokeAllForUserAsync(Guid userId);
}

public interface IPatientRepository
{
    Task<IEnumerable<Patient>> GetByTenantAsync(
        Guid tenantId,
        string? search = null,
        int page = 1,
        int pageSize = 20);
    Task<int> CountByTenantAsync(Guid tenantId, string? search = null);
    Task<Patient?> GetByIdAsync(Guid id);
    Task<Patient?> GetByEmailAsync(Guid tenantId, string email);
    Task AddAsync(Patient patient);
    Task UpdateAsync(Patient patient);
    Task DeleteAsync(Patient patient);
}

public interface IAuditLogRepository
{
    Task AddAsync(AuditLog log);
    Task<IEnumerable<AuditLog>> GetByTenantAsync(Guid tenantId, int take = 100);
    Task<IEnumerable<AuditLog>> GetRecentAsync(int take);
}

public interface IUnitOfWork : IDisposable, IAsyncDisposable
{
    IUserRepository Users { get; }
    ITenantRepository Tenants { get; }
    IInvitationRepository Invitations { get; }
    IRefreshTokenRepository RefreshTokens { get; }
    IAuditLogRepository AuditLogs { get; }
    IPatientRepository Patients { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
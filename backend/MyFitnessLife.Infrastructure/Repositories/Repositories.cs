using Microsoft.EntityFrameworkCore;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Interfaces;
using MyFitnessLife.Infrastructure.Data;

namespace MyFitnessLife.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _context;

    public UserRepository(AppDbContext context) => _context = context;

    public Task<ApplicationUser?> GetByIdAsync(Guid id)
        => _context.Users.Include(u => u.Tenant).FirstOrDefaultAsync(u => u.Id == id);

    public Task<ApplicationUser?> GetByEmailAsync(string email)
        => _context.Users.Include(u => u.Tenant).FirstOrDefaultAsync(u => u.Email == email);

    public Task<ApplicationUser?> GetByGoogleSubjectAsync(string subject)
        => _context.Users.Include(u => u.Tenant).FirstOrDefaultAsync(u => u.GoogleSubject == subject);

    public async Task<IEnumerable<ApplicationUser>> GetByTenantAsync(Guid tenantId, bool includeDeleted = false)
    {
        var query = _context.Users.AsNoTracking().Include(u => u.Tenant).AsQueryable();
        if (tenantId != Guid.Empty)
            query = query.Where(u => u.TenantId == tenantId);
        return await query.ToListAsync();
    }

    public Task<int> CountByTenantAsync(Guid tenantId)
        => _context.Users.CountAsync(u => u.TenantId == tenantId);

    public async Task AddAsync(ApplicationUser user)
        => await _context.Users.AddAsync(user);

    public Task UpdateAsync(ApplicationUser user)
    {
        _context.Users.Update(user);
        return Task.CompletedTask;
    }

    public Task<bool> EmailExistsAsync(string email)
        => _context.Users.AnyAsync(u => u.Email == email);
}

public class TenantRepository : ITenantRepository
{
    private readonly AppDbContext _context;

    public TenantRepository(AppDbContext context) => _context = context;

    public Task<Tenant?> GetByIdAsync(Guid id)
        => _context.Tenants.FirstOrDefaultAsync(t => t.Id == id);

    public Task<Tenant?> GetBySlugAsync(string slug)
        => _context.Tenants.FirstOrDefaultAsync(t => t.Slug == slug);

    public async Task<IEnumerable<Tenant>> GetAllAsync(bool includeInactive = true)
    {
        var query = _context.Tenants.AsNoTracking().AsQueryable();
        if (!includeInactive)
            query = query.Where(t => t.IsActive);
        return await query.ToListAsync();
    }

    public Task<int> CountActiveUsersAsync(Guid tenantId)
        => _context.Users.CountAsync(u => u.TenantId == tenantId && u.Status == Domain.Enums.UserStatus.Active);

    public Task<int> CountTotalAsync()
        => _context.Tenants.CountAsync();

    public Task<int> CountActiveAsync()
        => _context.Tenants.CountAsync(t => t.IsActive);

    public async Task AddAsync(Tenant tenant)
        => await _context.Tenants.AddAsync(tenant);

    public Task UpdateAsync(Tenant tenant)
    {
        _context.Tenants.Update(tenant);
        return Task.CompletedTask;
    }

    public async Task<IEnumerable<Tenant>> GetWithRecentActivityAsync(int days)
    {
        var cutoff = DateTime.UtcNow.AddDays(-days);
        return await _context.Tenants
            .AsNoTracking()
            .Where(t => t.IsActive)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }
}

public class InvitationRepository : IInvitationRepository
{
    private readonly AppDbContext _context;

    public InvitationRepository(AppDbContext context) => _context = context;

    public Task<Invitation?> GetByIdAsync(Guid id)
        => _context.Invitations.FirstOrDefaultAsync(i => i.Id == id);

    public Task<Invitation?> GetByTokenAsync(string token)
        => _context.Invitations.FirstOrDefaultAsync(i => i.Token == token);

    public Task<Invitation?> GetPendingByEmailAsync(Guid tenantId, string email)
        => _context.Invitations.FirstOrDefaultAsync(i =>
            i.TenantId == tenantId && i.Email == email && i.Status == Domain.Enums.InvitationStatus.Pending);

    public async Task<IEnumerable<Invitation>> GetByTenantAsync(Guid tenantId)
        => await _context.Invitations.AsNoTracking().Where(i => i.TenantId == tenantId).ToListAsync();

    public Task UpdateAsync(Invitation invitation)
    {
        _context.Invitations.Update(invitation);
        return Task.CompletedTask;
    }

    public async Task AddAsync(Invitation invitation)
        => await _context.Invitations.AddAsync(invitation);
}

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly AppDbContext _context;

    public RefreshTokenRepository(AppDbContext context) => _context = context;

    public Task<RefreshToken?> GetByTokenAsync(string token)
        => _context.RefreshTokens.FirstOrDefaultAsync(t => t.Token == token);

    public Task UpdateAsync(RefreshToken token)
    {
        _context.RefreshTokens.Update(token);
        return Task.CompletedTask;
    }

    public async Task AddAsync(RefreshToken token)
        => await _context.RefreshTokens.AddAsync(token);

    public async Task RevokeAllForUserAsync(Guid userId)
    {
        var tokens = await _context.RefreshTokens
            .Where(t => t.UserId == userId && !t.IsRevoked)
            .ToListAsync();

        if (tokens.Count == 0) return;

        foreach (var t in tokens)
        {
            t.IsRevoked = true;
            t.RevokedReason = "logged_out";
        }
        _context.RefreshTokens.UpdateRange(tokens);
        await _context.SaveChangesAsync();
    }
}

public class AuditLogRepository : IAuditLogRepository
{
    private readonly AppDbContext _context;

    public AuditLogRepository(AppDbContext context) => _context = context;

    public async Task AddAsync(AuditLog log)
        => await _context.AuditLogs.AddAsync(log);

    public async Task<IEnumerable<AuditLog>> GetByTenantAsync(Guid tenantId, int take = 100)
        => await _context.AuditLogs.AsNoTracking()
            .Where(a => a.TenantId == tenantId)
            .OrderByDescending(a => a.Timestamp)
            .Take(take)
            .ToListAsync();

    public async Task<IEnumerable<AuditLog>> GetRecentAsync(int take)
        => await _context.AuditLogs.AsNoTracking()
            .OrderByDescending(a => a.Timestamp)
            .Take(take)
            .ToListAsync();
}
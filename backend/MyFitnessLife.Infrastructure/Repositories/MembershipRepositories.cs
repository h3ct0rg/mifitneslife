using Microsoft.EntityFrameworkCore;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;
using MyFitnessLife.Infrastructure.Data;

namespace MyFitnessLife.Infrastructure.Repositories;

public class MembershipRepository : IMembershipRepository
{
    private readonly AppDbContext _context;

    public MembershipRepository(AppDbContext context) => _context = context;

    public async Task<IReadOnlyList<UserMembership>> GetByUserAsync(Guid userId, bool usableOnly = false)
    {
        var query = _context.UserMemberships.Include(m => m.Tenant).Where(m => m.UserId == userId);
        if (usableOnly)
            query = query.Where(m => m.Status == UserStatus.Active && (m.TenantId == null || m.Tenant!.IsActive));

        return await query
            .OrderByDescending(m => m.LastUsedAt)
            .ThenBy(m => m.CreatedAt)
            .ToListAsync();
    }

    public async Task<Dictionary<Guid, List<UserMembership>>> GetByUsersAsync(IReadOnlyCollection<Guid> userIds)
    {
        if (userIds.Count == 0)
            return new Dictionary<Guid, List<UserMembership>>();

        var ids = userIds.ToList();
        var rows = await _context.UserMemberships.AsNoTracking()
            .Include(m => m.Tenant)
            .Where(m => ids.Contains(m.UserId))
            .OrderByDescending(m => m.LastUsedAt)
            .ThenBy(m => m.CreatedAt)
            .ToListAsync();
        return rows.GroupBy(m => m.UserId).ToDictionary(g => g.Key, g => g.ToList());
    }

    public async Task<IReadOnlyList<UserMembership>> GetByTenantAsync(Guid tenantId, IReadOnlyCollection<UserRole>? roles = null)
    {
        var query = _context.UserMemberships.AsNoTracking()
            .Include(m => m.User)
            .Where(m => m.TenantId == tenantId && m.Status == UserStatus.Active);
        if (roles is { Count: > 0 })
        {
            var list = roles.ToList();
            query = query.Where(m => list.Contains(m.Role));
        }
        return await query.ToListAsync();
    }

    public Task<UserMembership?> GetByIdAsync(Guid id)
        => _context.UserMemberships.Include(m => m.Tenant).FirstOrDefaultAsync(m => m.Id == id);

    public Task<UserMembership?> FindAsync(Guid userId, Guid? tenantId, UserRole role)
        => _context.UserMemberships.Include(m => m.Tenant)
            .FirstOrDefaultAsync(m => m.UserId == userId && m.TenantId == tenantId && m.Role == role);

    public Task<int> CountByUserAsync(Guid userId)
        => _context.UserMemberships.CountAsync(m => m.UserId == userId);

    public Task<int> CountActiveSuperAdminsAsync(Guid? excludeMembershipId = null, Guid? excludeUserId = null)
        => _context.UserMemberships.CountAsync(m =>
            m.Role == UserRole.SuperAdmin
            && m.Status == UserStatus.Active
            && m.User!.Status == UserStatus.Active
            && (excludeMembershipId == null || m.Id != excludeMembershipId.Value)
            && (excludeUserId == null || m.UserId != excludeUserId.Value));

    public async Task AddAsync(UserMembership membership)
        => await _context.UserMemberships.AddAsync(membership);

    public Task RemoveAsync(UserMembership membership)
    {
        _context.UserMemberships.Remove(membership);
        return Task.CompletedTask;
    }
}

public class LoginSelectionTokenRepository : ILoginSelectionTokenRepository
{
    private readonly AppDbContext _context;

    public LoginSelectionTokenRepository(AppDbContext context) => _context = context;

    public async Task AddAsync(LoginSelectionToken token)
        => await _context.LoginSelectionTokens.AddAsync(token);

    public Task<LoginSelectionToken?> GetByHashAsync(string tokenHash)
        => _context.LoginSelectionTokens.FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

    public async Task<Guid?> TryConsumeAsync(string tokenHash, DateTime now)
    {
        // Un único UPDATE condicional: de dos peticiones simultáneas solo una afecta la fila.
        var affected = await _context.LoginSelectionTokens
            .Where(t => t.TokenHash == tokenHash && t.UsedAt == null && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now));
        if (affected != 1)
            return null;

        return await _context.LoginSelectionTokens.AsNoTracking()
            .Where(t => t.TokenHash == tokenHash)
            .Select(t => (Guid?)t.UserId)
            .FirstOrDefaultAsync();
    }
}

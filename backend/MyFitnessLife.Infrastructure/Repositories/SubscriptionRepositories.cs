using Microsoft.EntityFrameworkCore;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Interfaces;
using MyFitnessLife.Infrastructure.Data;

namespace MyFitnessLife.Infrastructure.Repositories;

public class SubscriptionPlanRepository : ISubscriptionPlanRepository
{
    private readonly AppDbContext _context;

    public SubscriptionPlanRepository(AppDbContext context) => _context = context;

    public async Task<IReadOnlyList<SubscriptionPlan>> GetAllAsync()
        => await _context.SubscriptionPlans
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Name)
            .ToListAsync();

    public Task<SubscriptionPlan?> GetByIdAsync(Guid id)
        => _context.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == id);

    public Task<SubscriptionPlan?> GetTrialAsync()
        => _context.SubscriptionPlans.FirstOrDefaultAsync(p => p.IsTrial);

    // La intercalación por defecto de SQL Server no distingue mayúsculas: "Mensual" == "mensual".
    public Task<bool> NameExistsAsync(string name, Guid? excludeId = null)
        => _context.SubscriptionPlans.AnyAsync(p => p.Name == name && (excludeId == null || p.Id != excludeId.Value));

    public async Task AddAsync(SubscriptionPlan plan)
        => await _context.SubscriptionPlans.AddAsync(plan);
}

public class TenantSubscriptionRepository : ITenantSubscriptionRepository
{
    private readonly AppDbContext _context;

    public TenantSubscriptionRepository(AppDbContext context) => _context = context;

    public async Task<TenantSubscription?> GetCurrentAsync(Guid tenantId, DateTime now)
    {
        var query = _context.TenantSubscriptions.AsNoTracking().Where(s => s.TenantId == tenantId);
        return await query.Where(s => s.StartsAt <= now)
                   .OrderByDescending(s => s.StartsAt).ThenByDescending(s => s.CreatedAt)
                   .FirstOrDefaultAsync()
               ?? await query.OrderByDescending(s => s.CreatedAt).FirstOrDefaultAsync();
    }

    public async Task<Dictionary<Guid, TenantSubscription>> GetCurrentByTenantAsync(DateTime now)
    {
        var started = await _context.TenantSubscriptions.AsNoTracking()
            .Where(s => s.StartsAt <= now)
            .GroupBy(s => s.TenantId)
            .Select(g => g.OrderByDescending(s => s.StartsAt).ThenByDescending(s => s.CreatedAt).First())
            .ToListAsync();
        var result = started.ToDictionary(s => s.TenantId);

        // Tenants cuyas suscripciones aún no empezaron (no ocurre con la API actual): la última creada.
        var pending = await _context.TenantSubscriptions.AsNoTracking()
            .Where(s => !_context.TenantSubscriptions.Any(x => x.TenantId == s.TenantId && x.StartsAt <= now))
            .GroupBy(s => s.TenantId)
            .Select(g => g.OrderByDescending(s => s.CreatedAt).First())
            .ToListAsync();
        foreach (var s in pending)
            result.TryAdd(s.TenantId, s);

        return result;
    }

    public async Task<IReadOnlyList<TenantSubscription>> GetHistoryAsync(Guid tenantId)
        => await _context.TenantSubscriptions.AsNoTracking()
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.StartsAt)
            .ThenByDescending(s => s.CreatedAt)
            .ToListAsync();

    public async Task AddAsync(TenantSubscription subscription)
        => await _context.TenantSubscriptions.AddAsync(subscription);
}

public class LoginEventRepository : ILoginEventRepository
{
    private readonly AppDbContext _context;

    public LoginEventRepository(AppDbContext context) => _context = context;

    public async Task AddAndSaveAsync(LoginEvent loginEvent)
    {
        var entry = await _context.LoginEvents.AddAsync(loginEvent);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch
        {
            // Que un fallo del registro no deje el evento pendiente para el próximo SaveChanges.
            entry.State = EntityState.Detached;
            throw;
        }
    }

    public Task<bool> ExistsForUserSinceAsync(Guid userId, DateTime sinceUtc)
        => _context.LoginEvents.AnyAsync(e => e.UserId == userId && e.OccurredAt >= sinceUtc);

    private IQueryable<LoginEvent> Filter(LoginEventFilter filter)
    {
        var query = _context.LoginEvents.AsNoTracking()
            .Where(e => e.OccurredAt >= filter.FromUtc && e.OccurredAt < filter.ToUtc);
        if (filter.TenantId.HasValue)
            query = query.Where(e => e.TenantId == filter.TenantId.Value);
        if (filter.Roles is { Count: > 0 })
        {
            var roles = filter.Roles.ToList();
            query = query.Where(e => roles.Contains(e.Role));
        }
        return query;
    }

    public async Task<IReadOnlyList<LoginEventPoint>> GetPointsAsync(LoginEventFilter filter)
        => await Filter(filter)
            .Select(e => new LoginEventPoint(e.UserId, e.Role, e.OccurredAt))
            .ToListAsync();

    public async Task<(IReadOnlyList<LoginEventRow> Items, int Total)> SearchAsync(
        LoginEventFilter filter, string? search, int page, int pageSize)
    {
        var query = Filter(filter);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(e =>
                (e.User!.Email != null && e.User.Email.Contains(s)) ||
                (e.User.FirstName + " " + e.User.LastName).Contains(s) ||
                (e.Tenant != null && e.Tenant.Name.Contains(s)));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(e => e.OccurredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new LoginEventRow(
                e.Id, e.OccurredAt, e.UserId,
                (e.User!.FirstName + " " + e.User.LastName).Trim(),
                e.User.Email,
                e.TenantId,
                e.Tenant != null ? e.Tenant.Name : null,
                e.Role, e.Method))
            .ToListAsync();

        // La proyección a record no pasa por el conversor UTC: se marca aquí.
        return (items.Select(r => r with { OccurredAt = DateTime.SpecifyKind(r.OccurredAt, DateTimeKind.Utc) }).ToList(), total);
    }
}

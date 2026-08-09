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

public class PatientRepository : IPatientRepository
{
    private readonly AppDbContext _context;

    public PatientRepository(AppDbContext context) => _context = context;

    private IQueryable<Patient> ApplySearch(IQueryable<Patient> query, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return query;

        var term = search.Trim();
        return query.Where(p =>
            p.FirstName.Contains(term) ||
            p.LastName.Contains(term) ||
            (p.FirstName + " " + p.LastName).Contains(term) ||
            (p.Phone != null && p.Phone.Contains(term)) ||
            p.Email.Contains(term));
    }

    public async Task<IEnumerable<Patient>> GetByTenantAsync(
        Guid tenantId,
        string? search = null,
        int page = 1,
        int pageSize = 20)
    {
        var query = _context.Patients.AsNoTracking()
            .Where(p => p.TenantId == tenantId);

        query = ApplySearch(query, search);

        return await query
            .OrderBy(p => p.FirstName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<int> CountByTenantAsync(Guid tenantId, string? search = null)
    {
        var query = _context.Patients.AsNoTracking()
            .Where(p => p.TenantId == tenantId);

        query = ApplySearch(query, search);

        return await query.CountAsync();
    }

    public Task<Patient?> GetByIdAsync(Guid id)
        => _context.Patients.FirstOrDefaultAsync(p => p.Id == id);

    public Task<Patient?> GetByEmailAsync(Guid tenantId, string email)
        => _context.Patients.FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Email == email);

    public async Task AddAsync(Patient patient)
        => await _context.Patients.AddAsync(patient);

    public Task UpdateAsync(Patient patient)
    {
        _context.Patients.Update(patient);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Patient patient)
    {
        _context.Patients.Remove(patient);
        return Task.CompletedTask;
    }
}

public class MeasurementRepository : IMeasurementRepository
{
    private readonly AppDbContext _context;

    public MeasurementRepository(AppDbContext context) => _context = context;

    public async Task<IEnumerable<Measurement>> GetByPatientAsync(
        Guid patientId,
        int page = 1,
        int pageSize = 50)
    {
        return await _context.Measurements.AsNoTracking()
            .Where(m => m.PatientId == patientId)
            .OrderByDescending(m => m.VisitDate)
            .ThenByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<int> CountByPatientAsync(Guid patientId)
        => await _context.Measurements.CountAsync(m => m.PatientId == patientId);

    public Task<Measurement?> GetByIdAsync(Guid id)
        => _context.Measurements.FirstOrDefaultAsync(m => m.Id == id);

    public Task<Measurement?> GetLatestAsync(Guid patientId)
        => _context.Measurements.AsNoTracking()
            .Where(m => m.PatientId == patientId)
            .OrderByDescending(m => m.VisitDate)
            .ThenByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync();

    public async Task<IEnumerable<Measurement>> GetHistoryAsync(Guid patientId, int take = 100)
        => await _context.Measurements.AsNoTracking()
            .Where(m => m.PatientId == patientId)
            .OrderBy(m => m.VisitDate)
            .ThenBy(m => m.CreatedAt)
            .Take(take)
            .ToListAsync();

    public async Task AddAsync(Measurement measurement)
        => await _context.Measurements.AddAsync(measurement);

    public Task UpdateAsync(Measurement measurement)
    {
        _context.Measurements.Update(measurement);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Measurement measurement)
    {
        _context.Measurements.Remove(measurement);
        return Task.CompletedTask;
    }
}
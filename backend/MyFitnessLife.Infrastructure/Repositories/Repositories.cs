using Microsoft.EntityFrameworkCore;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
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

public class AppointmentRepository : IAppointmentRepository
{
    private readonly AppDbContext _context;

    public AppointmentRepository(AppDbContext context) => _context = context;

    public async Task<IEnumerable<Appointment>> GetByRangeAsync(Guid tenantId, DateTime from, DateTime to)
        => await _context.Appointments.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.StartAt >= from && a.StartAt < to)
            .Include(a => a.Patient)
            .Include(a => a.Professional)
            .Include(a => a.Diet)
            .OrderBy(a => a.StartAt)
            .ToListAsync();

    public Task<Appointment?> GetByIdAsync(Guid id)
        => _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Professional)
            .Include(a => a.Diet)
            .FirstOrDefaultAsync(a => a.Id == id);

    public async Task AddAsync(Appointment appointment)
        => await _context.Appointments.AddAsync(appointment);

    public Task UpdateAsync(Appointment appointment)
    {
        _context.Appointments.Update(appointment);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Appointment appointment)
    {
        _context.Appointments.Remove(appointment);
        return Task.CompletedTask;
    }
}

public class FoodRepository : IFoodRepository
{
    private readonly AppDbContext _context;

    public FoodRepository(AppDbContext context) => _context = context;

    public async Task<IEnumerable<Food>> GetByTenantAsync(
        Guid tenantId,
        string? search = null,
        string? category = null,
        int page = 1,
        int pageSize = 50)
    {
        var query = _context.Foods.AsNoTracking().Where(f => f.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(f => f.Name.Contains(s) || f.Code!.Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var c = category.Trim();
            query = query.Where(f => f.Category == c);
        }

        return await query
            .OrderBy(f => f.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public Task<int> CountByTenantAsync(Guid tenantId, string? search = null, string? category = null)
    {
        var query = _context.Foods.AsNoTracking().Where(f => f.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(f => f.Name.Contains(s) || f.Code!.Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var c = category.Trim();
            query = query.Where(f => f.Category == c);
        }

        return query.CountAsync();
    }

    public async Task<IEnumerable<string>> GetCategoriesAsync(Guid tenantId)
        => await _context.Foods.AsNoTracking()
            .Where(f => f.TenantId == tenantId)
            .Select(f => f.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

    public Task<Food?> GetByIdAsync(Guid id)
        => _context.Foods.FirstOrDefaultAsync(f => f.Id == id);

    public Task<Food?> GetByNameAsync(Guid tenantId, string name)
        => _context.Foods.FirstOrDefaultAsync(f => f.TenantId == tenantId && f.Name == name);

    public async Task AddAsync(Food food)
        => await _context.Foods.AddAsync(food);

    public Task UpdateAsync(Food food)
    {
        _context.Foods.Update(food);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Food food)
    {
        _context.Foods.Remove(food);
        return Task.CompletedTask;
    }
}

public class DietRepository : IDietRepository
{
    private readonly AppDbContext _context;

    public DietRepository(AppDbContext context) => _context = context;

    public async Task<IEnumerable<Diet>> GetByTenantAsync(Guid tenantId)
        => await _context.Diets.AsNoTracking()
            .Where(d => d.TenantId == tenantId)
            .Include(d => d.Patient)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync();

    public async Task<IEnumerable<Diet>> GetPagedAsync(Guid tenantId, string? search = null, int page = 1, int pageSize = 20)
    {
        var query = _context.Diets.AsNoTracking().Where(d => d.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(d => d.Name.Contains(s)
                || (d.Patient != null && (d.Patient.FirstName + " " + d.Patient.LastName).Contains(s)));
        }

        return await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(d => d.Patient)
            .ToListAsync();
    }

    public Task<int> CountAsync(Guid tenantId, string? search = null)
    {
        var query = _context.Diets.AsNoTracking().Where(d => d.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(d => d.Name.Contains(s)
                || (d.Patient != null && (d.Patient.FirstName + " " + d.Patient.LastName).Contains(s)));
        }

        return query.CountAsync();
    }

    public Task<Diet?> GetByIdAsync(Guid id)
        => _context.Diets.AsSplitQuery()
            .Include(d => d.Patient)
            .Include(d => d.Meals)
                .ThenInclude(m => m.Items)
                    .ThenInclude(i => i.Food)
            .FirstOrDefaultAsync(d => d.Id == id);

    public Task<Diet?> GetByPatientAsync(Guid patientId)
        => _context.Diets.AsSplitQuery()
            .Include(d => d.Patient)
            .Include(d => d.Meals)
                .ThenInclude(m => m.Items)
                    .ThenInclude(i => i.Food)
            .FirstOrDefaultAsync(d => d.PatientId == patientId);

    public async Task AddAsync(Diet diet)
        => await _context.Diets.AddAsync(diet);

    public Task UpdateAsync(Diet diet)
    {
        _context.Entry(diet).State = EntityState.Modified;
        return Task.CompletedTask;
    }

    public async Task ReplaceMealsAsync(Diet diet, List<Meal> meals)
    {
        // Carga las comidas actuales (con sus items) con tracking para poder borrarlas.
        var currentMeals = await _context.Meals
            .Include(m => m.Items)
            .Where(m => m.DietId == diet.Id)
            .ToListAsync();

        _context.Meals.RemoveRange(currentMeals);

        foreach (var meal in meals)
        {
            meal.DietId = diet.Id;
            _context.Meals.Add(meal);
        }
    }

    public Task DeleteAsync(Diet diet)
    {
        _context.Diets.Remove(diet);
        return Task.CompletedTask;
    }
}

public class PatientDietRepository : IPatientDietRepository
{
    private readonly AppDbContext _context;

    public PatientDietRepository(AppDbContext context) => _context = context;

    public async Task<IEnumerable<PatientDiet>> GetHistoryByPatientAsync(Guid patientId)
        => await _context.PatientDiets.AsNoTracking()
            .Where(pd => pd.PatientId == patientId)
            .Include(pd => pd.Diet)
            .OrderByDescending(pd => pd.AssignedAt)
            .ToListAsync();

    public Task<PatientDiet?> GetActiveByPatientAsync(Guid patientId)
        => _context.PatientDiets.AsNoTracking()
            .Include(pd => pd.Diet)
            .FirstOrDefaultAsync(pd => pd.PatientId == patientId && pd.IsActive);

    public async Task AddAsync(PatientDiet patientDiet)
        => await _context.PatientDiets.AddAsync(patientDiet);

    public Task UpdateAsync(PatientDiet patientDiet)
    {
        _context.PatientDiets.Update(patientDiet);
        return Task.CompletedTask;
    }
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
public class ExerciseRepository : IExerciseRepository
{
    private readonly AppDbContext _context;

    public ExerciseRepository(AppDbContext context) => _context = context;

    public async Task<IEnumerable<Exercise>> GetPagedAsync(
        string? search = null,
        string? category = null,
        string? equipment = null,
        int page = 1,
        int pageSize = 50)
    {
        var query = _context.Exercises.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(e => e.Name.Contains(s) || e.Target!.Contains(s) || e.MuscleGroup!.Contains(s));
        }
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(e => e.Category == category);
        if (!string.IsNullOrWhiteSpace(equipment))
            query = query.Where(e => e.Equipment == equipment);

        return await query
            .OrderBy(e => e.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public Task<int> CountAsync(string? search = null, string? category = null, string? equipment = null)
    {
        var query = _context.Exercises.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(e => e.Name.Contains(s) || e.Target!.Contains(s) || e.MuscleGroup!.Contains(s));
        }
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(e => e.Category == category);
        if (!string.IsNullOrWhiteSpace(equipment))
            query = query.Where(e => e.Equipment == equipment);

        return query.CountAsync();
    }

    public async Task<IEnumerable<string>> GetCategoriesAsync()
        => await _context.Exercises.AsNoTracking()
            .Select(e => e.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

    public async Task<IEnumerable<string>> GetEquipmentAsync()
        => await _context.Exercises.AsNoTracking()
            .Select(e => e.Equipment)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

    public Task<Exercise?> GetByIdAsync(Guid id)
        => _context.Exercises.FirstOrDefaultAsync(e => e.Id == id);

    public Task<Exercise?> GetByNameAsync(string name)
        => _context.Exercises.FirstOrDefaultAsync(e => e.Name == name);

    public async Task AddAsync(Exercise exercise)
        => await _context.Exercises.AddAsync(exercise);

    public Task UpdateAsync(Exercise exercise)
    {
        _context.Exercises.Update(exercise);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Exercise exercise)
    {
        _context.Exercises.Remove(exercise);
        return Task.CompletedTask;
    }
}

public class WorkoutPlanRepository : IWorkoutPlanRepository
{
    private readonly AppDbContext _context;

    public WorkoutPlanRepository(AppDbContext context) => _context = context;

    public async Task<IEnumerable<WorkoutPlan>> GetByTenantAsync(Guid tenantId)
        => await _context.WorkoutPlans.AsNoTracking()
            .Where(p => p.TenantId == tenantId)
            .Include(p => p.Patient)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

    public async Task<IEnumerable<WorkoutPlan>> GetPagedAsync(Guid tenantId, string? search = null, int page = 1, int pageSize = 20)
    {
        var query = _context.WorkoutPlans.AsNoTracking().Where(p => p.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(p => p.Name.Contains(s)
                || (p.Patient != null && (p.Patient.FirstName + " " + p.Patient.LastName).Contains(s)));
        }

        return await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(p => p.Patient)
            .ToListAsync();
    }

    public Task<int> CountAsync(Guid tenantId, string? search = null)
    {
        var query = _context.WorkoutPlans.AsNoTracking().Where(p => p.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(p => p.Name.Contains(s)
                || (p.Patient != null && (p.Patient.FirstName + " " + p.Patient.LastName).Contains(s)));
        }

        return query.CountAsync();
    }

    public Task<WorkoutPlan?> GetByIdAsync(Guid id)
        => _context.WorkoutPlans.AsSplitQuery()
            .Include(p => p.Patient)
            .Include(p => p.Days)
                .ThenInclude(d => d.Exercises)
                    .ThenInclude(e => e.Exercise)
            .FirstOrDefaultAsync(p => p.Id == id);

    public Task<WorkoutPlan?> GetByPatientAsync(Guid patientId)
        => _context.WorkoutPlans.AsSplitQuery()
            .Include(p => p.Patient)
            .Include(p => p.Days)
                .ThenInclude(d => d.Exercises)
                    .ThenInclude(e => e.Exercise)
            .FirstOrDefaultAsync(p => p.PatientId == patientId);

    public async Task AddAsync(WorkoutPlan plan)
        => await _context.WorkoutPlans.AddAsync(plan);

    public Task UpdateAsync(WorkoutPlan plan)
    {
        _context.Entry(plan).State = EntityState.Modified;
        return Task.CompletedTask;
    }

    public async Task ReplaceDaysAsync(WorkoutPlan plan, List<WorkoutDay> days)
    {
        var currentDays = await _context.WorkoutDays
            .Include(d => d.Exercises)
            .Where(d => d.PlanId == plan.Id)
            .ToListAsync();

        _context.WorkoutDays.RemoveRange(currentDays);

        foreach (var day in days)
        {
            day.PlanId = plan.Id;
            _context.WorkoutDays.Add(day);
        }
    }

    public Task DeleteAsync(WorkoutPlan plan)
    {
        _context.WorkoutPlans.Remove(plan);
        return Task.CompletedTask;
    }
}

public class PatientPhotoRepository : IPatientPhotoRepository
{
    private readonly AppDbContext _context;

    public PatientPhotoRepository(AppDbContext context) => _context = context;

    public async Task<IEnumerable<PatientPhoto>> GetByPatientAsync(Guid patientId)
        => await _context.PatientPhotos.AsNoTracking()
            .Where(p => p.PatientId == patientId)
            .OrderByDescending(p => p.TakenAt)
            .ToListAsync();

    public Task<PatientPhoto?> GetByIdAsync(Guid id)
        => _context.PatientPhotos.FirstOrDefaultAsync(p => p.Id == id);

    public async Task AddAsync(PatientPhoto photo)
        => await _context.PatientPhotos.AddAsync(photo);

    public Task DeleteAsync(PatientPhoto photo)
    {
        _context.PatientPhotos.Remove(photo);
        return Task.CompletedTask;
    }
}

public class OutboxRepository : IOutboxRepository
{
    private readonly AppDbContext _context;

    public OutboxRepository(AppDbContext context) => _context = context;

    public async Task<IEnumerable<OutboxMessage>> GetPendingDueAsync(int take)
        => await _context.OutboxMessages
            .Where(m => m.Status == NotificationStatus.Pending
                && (m.NextAttemptAt == null || m.NextAttemptAt <= DateTime.UtcNow))
            .OrderBy(m => m.CreatedAt)
            .Take(take)
            .ToListAsync();

    public Task<OutboxMessage?> GetByIdAsync(Guid id)
        => _context.OutboxMessages.FirstOrDefaultAsync(m => m.Id == id);

    public async Task AddAsync(OutboxMessage message)
        => await _context.OutboxMessages.AddAsync(message);

    public Task UpdateAsync(OutboxMessage message)
    {
        _context.OutboxMessages.Update(message);
        return Task.CompletedTask;
    }

    public async Task<IEnumerable<OutboxMessage>> GetByTenantAsync(Guid tenantId, int take = 100)
        => await _context.OutboxMessages.AsNoTracking()
            .Where(m => m.TenantId == tenantId)
            .OrderByDescending(m => m.CreatedAt)
            .Take(take)
            .ToListAsync();
}

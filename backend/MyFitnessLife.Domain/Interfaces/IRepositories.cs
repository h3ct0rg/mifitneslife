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

public interface IOutboxRepository
{
    Task<IEnumerable<OutboxMessage>> GetPendingDueAsync(int take);
    Task<OutboxMessage?> GetByIdAsync(Guid id);
    Task AddAsync(OutboxMessage message);
    Task UpdateAsync(OutboxMessage message);
    Task<IEnumerable<OutboxMessage>> GetByTenantAsync(Guid tenantId, int take = 100);
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

public interface IMeasurementRepository
{
    Task<IEnumerable<Measurement>> GetByPatientAsync(
        Guid patientId,
        int page = 1,
        int pageSize = 50);
    Task<int> CountByPatientAsync(Guid patientId);
    Task<Measurement?> GetByIdAsync(Guid id);
    Task<Measurement?> GetLatestAsync(Guid patientId);
    Task<IEnumerable<Measurement>> GetHistoryAsync(Guid patientId, int take = 100);
    Task AddAsync(Measurement measurement);
    Task UpdateAsync(Measurement measurement);
    Task DeleteAsync(Measurement measurement);
}

public interface IAppointmentRepository
{
    Task<IEnumerable<Appointment>> GetByRangeAsync(Guid tenantId, DateTime from, DateTime to);
    Task<Appointment?> GetByIdAsync(Guid id);
    Task AddAsync(Appointment appointment);
    Task UpdateAsync(Appointment appointment);
    Task DeleteAsync(Appointment appointment);
}

public interface IFoodRepository
{
    Task<IEnumerable<Food>> GetByTenantAsync(
        Guid tenantId,
        string? search = null,
        string? category = null,
        int page = 1,
        int pageSize = 50);
    Task<int> CountByTenantAsync(Guid tenantId, string? search = null, string? category = null);
    Task<IEnumerable<string>> GetCategoriesAsync(Guid tenantId);
    Task<Food?> GetByIdAsync(Guid id);
    Task<Food?> GetByNameAsync(Guid tenantId, string name);
    Task AddAsync(Food food);
    Task UpdateAsync(Food food);
    Task DeleteAsync(Food food);
}

public interface IDietRepository
{
    Task<IEnumerable<Diet>> GetByTenantAsync(Guid tenantId);
    Task<IEnumerable<Diet>> GetPagedAsync(Guid tenantId, string? search = null, int page = 1, int pageSize = 20);
    Task<int> CountAsync(Guid tenantId, string? search = null);
    Task<Diet?> GetByIdAsync(Guid id);
    Task<Diet?> GetByPatientAsync(Guid patientId);
    Task AddAsync(Diet diet);
    Task UpdateAsync(Diet diet);
    Task ReplaceMealsAsync(Diet diet, List<Meal> meals);
    Task DeleteAsync(Diet diet);
}

public interface IPatientDietRepository
{
    Task<IEnumerable<PatientDiet>> GetHistoryByPatientAsync(Guid patientId);
    Task<PatientDiet?> GetActiveByPatientAsync(Guid patientId);
    Task AddAsync(PatientDiet patientDiet);
    Task UpdateAsync(PatientDiet patientDiet);
}

public interface IExerciseRepository
{
    Task<IEnumerable<Exercise>> GetPagedAsync(
        string? search = null,
        string? category = null,
        string? equipment = null,
        int page = 1,
        int pageSize = 50);
    Task<int> CountAsync(string? search = null, string? category = null, string? equipment = null);
    Task<IEnumerable<string>> GetCategoriesAsync();
    Task<IEnumerable<string>> GetEquipmentAsync();
    Task<Exercise?> GetByIdAsync(Guid id);
    Task<Exercise?> GetByNameAsync(string name);
    Task AddAsync(Exercise exercise);
    Task UpdateAsync(Exercise exercise);
    Task DeleteAsync(Exercise exercise);
}

public interface IWorkoutPlanRepository
{
    Task<IEnumerable<WorkoutPlan>> GetByTenantAsync(Guid tenantId);
    Task<IEnumerable<WorkoutPlan>> GetPagedAsync(Guid tenantId, string? search = null, int page = 1, int pageSize = 20);
    Task<int> CountAsync(Guid tenantId, string? search = null);
    Task<WorkoutPlan?> GetByIdAsync(Guid id);
    Task<WorkoutPlan?> GetByPatientAsync(Guid patientId);
    Task AddAsync(WorkoutPlan plan);
    Task UpdateAsync(WorkoutPlan plan);
    Task ReplaceDaysAsync(WorkoutPlan plan, List<WorkoutDay> days);
    Task DeleteAsync(WorkoutPlan plan);
}

public interface IPatientPhotoRepository
{
    Task<IEnumerable<PatientPhoto>> GetByPatientAsync(Guid patientId);
    Task<PatientPhoto?> GetByIdAsync(Guid id);
    Task AddAsync(PatientPhoto photo);
    Task DeleteAsync(PatientPhoto photo);
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
    IMeasurementRepository Measurements { get; }
    IAppointmentRepository Appointments { get; }
    IFoodRepository Foods { get; }
    IDietRepository Diets { get; }
    IPatientDietRepository PatientDiets { get; }
    IExerciseRepository Exercises { get; }
    IWorkoutPlanRepository WorkoutPlans { get; }
    IPatientPhotoRepository PatientPhotos { get; }
    IOutboxRepository Outbox { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
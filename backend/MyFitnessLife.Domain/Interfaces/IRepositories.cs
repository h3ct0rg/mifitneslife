using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;

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
    /// <summary>Subconjunto de <paramref name="emails"/> con cuenta de usuario en el tenant (una consulta).</summary>
    Task<HashSet<string>> GetEmailsWithAccountAsync(Guid tenantId, IReadOnlyCollection<string> emails);

    // Consultas de plataforma (SuperAdmin): paginadas/agregadas en BD.
    Task<IEnumerable<ApplicationUser>> SearchAsync(string? search, Guid? tenantId, UserRole? role, int page, int pageSize);
    Task<int> CountSearchAsync(string? search, Guid? tenantId, UserRole? role);
    Task<int> CountAllAsync(UserStatus? status = null);
    Task<int> CountCreatedSinceAsync(DateTime since);
    Task<Dictionary<UserRole, int>> CountByRoleAsync();
    Task<Dictionary<(int Year, int Month), int>> CountCreatedByMonthAsync(DateTime since);
    Task<Dictionary<Guid, int>> CountGroupedByTenantAsync();
    Task<Dictionary<Guid, int>> CountLoggedInSinceGroupedByTenantAsync(DateTime since);
    Task<int> CountActiveByRoleAsync(UserRole role, Guid? excludeUserId = null);
    /// <summary>Deja en AspNetUserRoles exactamente el conjunto de roles indicado. Se persiste con SaveChanges.</summary>
    Task SyncIdentityRolesAsync(Guid userId, IReadOnlyCollection<UserRole> roles);
}

public interface IMembershipRepository
{
    /// <summary>Membresías del usuario (con Tenant). usableOnly: Status Active y tenant activo (o SuperAdmin). Orden: última usada primero.</summary>
    Task<IReadOnlyList<UserMembership>> GetByUserAsync(Guid userId, bool usableOnly = false);
    Task<Dictionary<Guid, List<UserMembership>>> GetByUsersAsync(IReadOnlyCollection<Guid> userIds);
    /// <summary>Membresías activas de un tenant (con User), opcionalmente filtradas por roles.</summary>
    Task<IReadOnlyList<UserMembership>> GetByTenantAsync(Guid tenantId, IReadOnlyCollection<UserRole>? roles = null);
    Task<UserMembership?> GetByIdAsync(Guid id);
    Task<UserMembership?> FindAsync(Guid userId, Guid? tenantId, UserRole role);
    Task<int> CountByUserAsync(Guid userId);
    /// <summary>Membresías SuperAdmin activas de usuarios activos, excluyendo opcionalmente una membresía o un usuario.</summary>
    Task<int> CountActiveSuperAdminsAsync(Guid? excludeMembershipId = null, Guid? excludeUserId = null);
    Task AddAsync(UserMembership membership);
    Task RemoveAsync(UserMembership membership);
}

public interface ILoginSelectionTokenRepository
{
    Task AddAsync(LoginSelectionToken token);
    Task<LoginSelectionToken?> GetByHashAsync(string tokenHash);
    /// <summary>
    /// Consume el token de forma atómica (UPDATE ... WHERE hash AND UsedAt IS NULL AND ExpiresAt &gt; now).
    /// Devuelve el UserId solo si esta llamada lo consumió (1 fila afectada); si no, null.
    /// </summary>
    Task<Guid?> TryConsumeAsync(string tokenHash, DateTime now);
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
    Task<int> CountCreatedSinceAsync(DateTime since);
    Task<Dictionary<(int Year, int Month), int>> CountCreatedByMonthAsync(DateTime since);
}

public interface IInvitationRepository
{
    Task<Invitation?> GetByIdAsync(Guid id);
    Task<Invitation?> GetByTokenAsync(string token);
    Task<Invitation?> GetPendingByEmailAsync(Guid tenantId, string email);
    Task<Invitation?> GetPendingByEmailAndRoleAsync(Guid tenantId, string email, UserRole role);
    /// <summary>Subconjunto de <paramref name="emails"/> con invitación Pending en el tenant (una consulta).</summary>
    Task<HashSet<string>> GetEmailsWithPendingInvitationAsync(Guid tenantId, IReadOnlyCollection<string> emails);
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
    /// <summary>Marca revocados (sin guardar) los refresh tokens vigentes del usuario emitidos para esa membresía (null = tokens antiguos).</summary>
    Task RevokeForMembershipAsync(Guid userId, Guid? membershipId, string reason);
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
    Task<int> CountAllAsync();
    Task<int> CountCreatedSinceAsync(DateTime since);
    Task<Dictionary<(int Year, int Month), int>> CountCreatedByMonthAsync(DateTime since);
    Task<Dictionary<Guid, int>> CountGroupedByTenantAsync();
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
    Task<IEnumerable<Food>> GetPagedAsync(
        string? search = null,
        string? category = null,
        int page = 1,
        int pageSize = 50);
    Task<int> CountAsync(string? search = null, string? category = null);
    Task<IEnumerable<string>> GetCategoriesAsync();
    Task<Food?> GetByIdAsync(Guid id);
    Task<Food?> GetByNameAsync(string name);
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

public record TenantDeleteImpact(int Users, int Patients, int Appointments, int OtherRecords);

public record UserDeleteImpact(bool PatientProfile, int Appointments, int OtherRecords);

/// <summary>
/// Borrado físico (hard delete) de tenants y usuarios. Cada Purge* ejecuta todas las
/// sentencias en orden explícito dentro de una transacción propia (todo o nada) e
/// inserta el evento de auditoría recibido en la misma transacción.
/// Los Get*Impact usan exactamente los mismos filtros que el borrado.
/// </summary>
public interface IDataPurgeRepository
{
    Task<TenantDeleteImpact> GetTenantImpactAsync(Guid tenantId);
    Task<UserDeleteImpact> GetUserImpactAsync(Guid userId);
    Task PurgeTenantAsync(Guid tenantId, AuditLog deletionEvent);
    Task PurgeUserAsync(Guid userId, AuditLog deletionEvent);
}

public record PatientKpis(int Total, int Active, int NewThisMonth, int NewPrevMonth, int WithDiet, int WithWorkout, int WithoutFollowUp);
public record MonthStatusCount(int Year, int Month, AppointmentStatus Status, int Count);
public record ProfessionalKpiRow(Guid Id, string FullName, UserRole Role, int CompletedThisMonth, int NoShowThisMonth, int Upcoming, int PatientsAttendedThisMonth);
public record AtRiskPatientRow(Guid Id, string FullName, DateTime? LastActivityAt);
public record TodayAppointmentRow(Guid Id, DateTime StartAt, Guid PatientId, string PatientName, string ProfessionalName, AppointmentStatus Status);

/// <summary>
/// Consultas agregadas (solo lectura) para el dashboard de gestión del tenant.
/// professionalId != null restringe las consultas de citas a ese profesional.
/// </summary>
public interface IDashboardRepository
{
    Task<PatientKpis> GetPatientKpisAsync(Guid tenantId, DateTime thisMonthStart, DateTime prevMonthStart, DateTime followUpCutoff, DateTime now);
    Task<IReadOnlyList<MonthStatusCount>> GetAppointmentsByMonthAndStatusAsync(Guid tenantId, Guid? professionalId, DateTime from, DateTime to);
    Task<int> CountAppointmentsAsync(Guid tenantId, Guid? professionalId, DateTime from, DateTime to, IReadOnlyCollection<AppointmentStatus> statuses);
    Task<Dictionary<(int Year, int Month), int>> GetNewPatientsByMonthAsync(Guid tenantId, DateTime from, DateTime to);
    Task<Dictionary<(int Year, int Month), int>> GetMeasurementsByMonthAsync(Guid tenantId, DateTime from, DateTime to);
    Task<IReadOnlyList<ProfessionalKpiRow>> GetProfessionalKpisAsync(Guid tenantId, DateTime monthStart, DateTime monthEnd, DateTime now);
    Task<IReadOnlyList<AtRiskPatientRow>> GetAtRiskPatientsAsync(Guid tenantId, DateTime followUpCutoff, DateTime now, int take);
    Task<IReadOnlyList<TodayAppointmentRow>> GetAppointmentsInRangeAsync(Guid tenantId, Guid? professionalId, DateTime from, DateTime to, int take);
}

public interface IUnitOfWork : IDisposable, IAsyncDisposable
{
    IDataPurgeRepository Purge { get; }
    IDashboardRepository Dashboard { get; }
    IMembershipRepository Memberships { get; }
    ILoginSelectionTokenRepository SelectionTokens { get; }
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
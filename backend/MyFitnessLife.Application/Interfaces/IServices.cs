using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.DTOs.Appointments;
using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Application.DTOs.Dashboard;
using MyFitnessLife.Application.DTOs.Diets;
using MyFitnessLife.Application.DTOs.Exercises;
using MyFitnessLife.Application.DTOs.Foods;
using MyFitnessLife.Application.DTOs.Measurements;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.DTOs.PatientPhotos;
using MyFitnessLife.Application.DTOs.Users;
using MyFitnessLife.Application.DTOs.WorkoutPlans;
using MyFitnessLife.Domain.Entities;

namespace MyFitnessLife.Application.Interfaces;

public interface IAuthService
{
    Task<LoginResult> LoginAsync(LoginRequest request);
    Task<LoginResult> GoogleLoginAsync(GoogleLoginRequest request);
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> SelectMembershipAsync(SelectMembershipRequest request);
    Task<AuthResponse> SwitchMembershipAsync(Guid userId, Guid? currentMembershipId, SwitchMembershipRequest request);
    Task<AuthResponse> RefreshTokenAsync(string refreshToken);
    Task LogoutAsync(Guid userId);
    Task<UserDto> GetUserByIdAsync(Guid id, Guid? currentMembershipId = null);
}

public interface IUserManagementService
{
    Task<InviteUserResponse> InviteUserAsync(Guid inviterId, Guid tenantId, InviteUserRequest request);
    Task<MembershipDto> AcceptInvitationAsync(Guid userId, AcceptInvitationRequest request);
    Task UpdateUserRoleAsync(Guid actorId, Guid tenantId, UpdateUserRoleRequest request);
    Task<IEnumerable<UserListItemDto>> GetTenantUsersAsync(Guid tenantId);
    Task<UserDto> GetUserByIdAsync(Guid id, Guid? currentMembershipId = null);
    Task<IEnumerable<InvitationDto>> GetInvitationsAsync(Guid tenantId);
    Task<InvitationDto> ResendInvitationAsync(Guid tenantId, Guid invitationId);
    Task<InvitationDto> RevokeInvitationAsync(Guid tenantId, Guid invitationId);
    Task<InvitationInfoDto> GetInvitationInfoAsync(string token);
}

public interface ISuperAdminService
{
    Task<AdminDashboardDto> GetDashboardAsync();
    Task<IEnumerable<TenantDto>> GetTenantsAsync();
    Task<TenantDto> GetTenantAsync(Guid id);
    Task<TenantDto> CreateTenantAsync(CreateTenantRequest request);
    Task<TenantDto> UpdateTenantAsync(Guid id, UpdateTenantRequest request);
    Task<IEnumerable<TenantActivityDto>> GetTenantActivityAsync(Guid tenantId);
    Task<PagedResult<AdminUserDto>> GetUsersAsync(string? search, Guid? tenantId, string? role, int page, int pageSize);
    Task<AdminUserDto> CreateUserAsync(CreateAdminUserRequest request);
    Task<AdminUserDto> UpdateUserAsync(Guid actorId, Guid id, UpdateAdminUserRequest request);
    Task<IEnumerable<MembershipDto>> GetUserMembershipsAsync(Guid userId);
    Task<MembershipDto> AddMembershipAsync(Guid actorId, Guid userId, AddMembershipRequest request);
    Task RemoveMembershipAsync(Guid actorId, Guid userId, Guid membershipId);
    Task<TenantDeleteImpactDto> GetTenantDeleteImpactAsync(Guid id);
    Task DeleteTenantAsync(Guid actorId, Guid id);
    Task<UserDeleteImpactDto> GetUserDeleteImpactAsync(Guid id);
    Task DeleteUserAsync(Guid actorId, Guid id);
}

/// <summary>Planes de suscripción y suscripciones de tenants (solo SuperAdmin).</summary>
public interface ISubscriptionService
{
    Task<IReadOnlyList<PlanDto>> GetPlansAsync();
    /// <summary>Catálogo público: planes activos no-trial (por SortOrder) + días del trial.</summary>
    Task<PublicPlansDto> GetPublicPlansAsync();
    Task<PlanDto> CreatePlanAsync(SavePlanRequest request);
    Task<PlanDto> UpdatePlanAsync(Guid id, SavePlanRequest request);
    Task<IReadOnlyList<TenantSubscriptionDto>> GetTenantSubscriptionsAsync(Guid tenantId);
    /// <summary>Nueva suscripción desde ahora (reiniciar = mismo plan). Crea una fila de historial.</summary>
    Task<SubscriptionSummaryDto> AssignAsync(Guid actorId, Guid tenantId, AssignSubscriptionRequest request);
}

/// <summary>Bloqueo por suscripción (U1): ¿el tenant tiene una suscripción vigente?</summary>
public interface ISubscriptionGate
{
    Task<bool> IsTenantActiveAsync(Guid tenantId);
}

/// <summary>Conexiones registradas (solo SuperAdmin). from inclusivo, to exclusivo (UTC).</summary>
public interface IConnectionService
{
    Task<ConnectionsSummaryDto> GetSummaryAsync(DateTime? fromUtc, DateTime? toUtc, Guid? tenantId, string? role);
    Task<PagedResult<ConnectionDto>> GetConnectionsAsync(DateTime? fromUtc, DateTime? toUtc, Guid? tenantId, string? role, string? search, int page, int pageSize);
}

/// <summary>
/// Registro de LoginEvent (AC-11). Nunca lanza: los errores se loguean y se ignoran para no
/// romper el login.
/// </summary>
public interface ILoginEventRecorder
{
    Task RecordAsync(Guid userId, UserMembership membership, Domain.Enums.LoginMethod method);
    /// <summary>Evento Session solo si el usuario no tiene ningún evento en el día UTC actual.</summary>
    Task RecordSessionIfFirstTodayAsync(Guid userId, UserMembership membership);
}

/// <summary>Datos de la petición HTTP actual que necesita la capa de aplicación.</summary>
public interface IRequestInfo
{
    string? UserAgent { get; }
}

public interface IDashboardService
{
    Task<DashboardKpisDto> GetKpisAsync(Guid tenantId, Guid userId, Domain.Enums.UserRole role);
}

public interface ITenantActivityService
{
    Task RecordLoginAsync(Guid? tenantId, string email);
    Task RecordCreateTenantAsync(Guid tenantId, string name);
    Task RecordEntityAsync(Guid tenantId, string action, string entity, string? entityId, string? email);
}

public interface IPatientService
{
    Task<PagedResult<PatientDto>> GetPagedAsync(
        Guid tenantId,
        string? search = null,
        int page = 1,
        int pageSize = 20);
    Task<PatientDto> GetByIdAsync(Guid tenantId, Guid id);
    Task<PatientDto?> GetByEmailAsync(Guid tenantId, string email);
    Task<PatientCreatedDto> CreateAsync(Guid tenantId, Guid actorId, CreatePatientRequest request);
    Task<PatientInviteResultDto> InviteAsync(Guid tenantId, Guid actorId, Guid patientId);
    Task<PatientDto> UpdateAsync(Guid tenantId, Guid id, UpdatePatientRequest request);
    Task DeleteAsync(Guid tenantId, Guid id);
}

public interface IMeasurementService
{
    Task<PagedResult<MeasurementDto>> GetByPatientAsync(
        Guid tenantId,
        Guid patientId,
        int page = 1,
        int pageSize = 20);
    Task<MeasurementDto> GetByIdAsync(Guid tenantId, Guid patientId, Guid id);
    Task<MeasurementDto> CreateAsync(Guid tenantId, Guid patientId, CreateMeasurementRequest request);
    Task<MeasurementDto> UpdateAsync(Guid tenantId, Guid patientId, Guid id, UpdateMeasurementRequest request);
    Task DeleteAsync(Guid tenantId, Guid patientId, Guid id);
    Task<MeasurementDashboardDto> GetDashboardAsync(Guid tenantId, Guid patientId);
    Task<MeasurementIndexDto> ComputeIndexesAsync(Measurement measurement);
}

public interface IAppointmentService
{
    Task<IEnumerable<AppointmentDto>> GetByRangeAsync(Guid tenantId, DateTime from, DateTime to);
    Task<AppointmentDto> CreateAsync(Guid tenantId, CreateAppointmentRequest request);
    Task<AppointmentDto> UpdateAsync(Guid tenantId, Guid id, UpdateAppointmentRequest request);
    Task DeleteAsync(Guid tenantId, Guid id);
    Task<IEnumerable<ProfessionalDto>> GetProfessionalsAsync(Guid tenantId);
}

public interface IFoodService
{
    Task<PagedResult<FoodDto>> GetPagedAsync(
        string? search = null,
        string? category = null,
        int page = 1,
        int pageSize = 50);
    Task<IEnumerable<string>> GetCategoriesAsync();
    Task<FoodDto> GetByIdAsync(Guid id);
    Task<FoodDto> CreateAsync(CreateFoodRequest request);
    Task<FoodDto> UpdateAsync(Guid id, UpdateFoodRequest request);
    Task DeleteAsync(Guid id);
}

public interface IDietService
{
    Task<IEnumerable<DietDto>> GetByTenantAsync(Guid tenantId);
    Task<PagedResult<DietDto>> GetPagedAsync(Guid tenantId, string? search = null, int page = 1, int pageSize = 20);
    Task<DietDto> GetByIdAsync(Guid tenantId, Guid id);
    Task<DietDto?> GetByPatientAsync(Guid tenantId, Guid patientId);
    Task<IEnumerable<PatientDietDto>> GetHistoryByPatientAsync(Guid tenantId, Guid patientId);
    Task<DietDto> CreateAsync(Guid tenantId, CreateDietRequest request);
    Task<DietDto> UpdateAsync(Guid tenantId, Guid id, UpdateDietRequest request);
    Task AssignToPatientAsync(Guid tenantId, Guid patientId, Guid? dietId);
    Task DeleteAsync(Guid tenantId, Guid id);
}

public interface IExerciseService
{
    Task<PagedResult<ExerciseDto>> GetPagedAsync(
        string? search = null,
        string? category = null,
        string? equipment = null,
        int page = 1,
        int pageSize = 50);
    Task<IEnumerable<string>> GetCategoriesAsync();
    Task<IEnumerable<string>> GetEquipmentAsync();
    Task<ExerciseDto> GetByIdAsync(Guid id);
    Task<ExerciseDto> CreateAsync(CreateExerciseRequest request);
    Task<ExerciseDto> UpdateAsync(Guid id, UpdateExerciseRequest request);
    Task DeleteAsync(Guid id);
    Task<int> ImportMediaAsync();
}

public interface IWorkoutPlanService
{
    Task<IEnumerable<WorkoutPlanDto>> GetByTenantAsync(Guid tenantId);
    Task<PagedResult<WorkoutPlanDto>> GetPagedAsync(Guid tenantId, string? search = null, int page = 1, int pageSize = 20);
    Task<WorkoutPlanDto> GetByIdAsync(Guid tenantId, Guid id);
    Task<WorkoutPlanDto?> GetByPatientAsync(Guid tenantId, Guid patientId);
    Task<WorkoutPlanDto> CreateAsync(Guid tenantId, CreateWorkoutPlanRequest request);
    Task<WorkoutPlanDto> UpdateAsync(Guid tenantId, Guid id, UpdateWorkoutPlanRequest request);
    Task AssignToPatientAsync(Guid tenantId, Guid patientId, Guid? planId);
    Task DeleteAsync(Guid tenantId, Guid id);
}

public interface IPatientPhotoService
{
    Task<IEnumerable<PatientPhotoDto>> GetByPatientAsync(Guid tenantId, Guid patientId);
    Task<PatientPhotoDto> CreateAsync(Guid tenantId, Guid patientId, string fileName, DateTime takenAt);
    Task DeleteAsync(Guid tenantId, Guid patientId, Guid id);
}
using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.DTOs.Appointments;
using MyFitnessLife.Application.DTOs.Auth;
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
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> GoogleLoginAsync(GoogleLoginRequest request);
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> RefreshTokenAsync(string refreshToken);
    Task LogoutAsync(Guid userId);
    Task<UserDto> GetUserByIdAsync(Guid id);
}

public interface IUserManagementService
{
    Task<InviteUserResponse> InviteUserAsync(Guid inviterId, Guid tenantId, InviteUserRequest request);
    Task AcceptInvitationAsync(Guid userId, AcceptInvitationRequest request);
    Task UpdateUserRoleAsync(Guid actorId, UpdateUserRoleRequest request);
    Task<IEnumerable<UserListItemDto>> GetTenantUsersAsync(Guid tenantId);
    Task<UserDto> GetUserByIdAsync(Guid id);
    Task<IEnumerable<InvitationDto>> GetInvitationsAsync(Guid tenantId);
    Task<InvitationDto> ResendInvitationAsync(Guid tenantId, Guid invitationId);
    Task<InvitationDto> RevokeInvitationAsync(Guid tenantId, Guid invitationId);
    Task<InvitationInfoDto> GetInvitationInfoAsync(string token);
}

public interface ISuperAdminService
{
    Task<AdminDashboardDto> GetDashboardAsync();
    Task<IEnumerable<TenantDto>> GetTenantsAsync();
    Task<TenantDto> CreateTenantAsync(CreateTenantRequest request);
    Task<IEnumerable<TenantActivityDto>> GetTenantActivityAsync(Guid tenantId);
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
    Task<PatientDto> CreateAsync(Guid tenantId, CreatePatientRequest request);
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
    Task<PagedResult<FoodDto>> GetByTenantAsync(
        Guid tenantId,
        string? search = null,
        string? category = null,
        int page = 1,
        int pageSize = 50);
    Task<IEnumerable<string>> GetCategoriesAsync(Guid tenantId);
    Task<FoodDto> GetByIdAsync(Guid tenantId, Guid id);
    Task<FoodDto> CreateAsync(Guid tenantId, CreateFoodRequest request);
    Task<FoodDto> UpdateAsync(Guid tenantId, Guid id, UpdateFoodRequest request);
    Task DeleteAsync(Guid tenantId, Guid id);
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
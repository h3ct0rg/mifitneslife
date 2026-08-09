using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.DTOs.Users;

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
    Task<PatientDto> CreateAsync(Guid tenantId, CreatePatientRequest request);
    Task<PatientDto> UpdateAsync(Guid tenantId, Guid id, UpdatePatientRequest request);
    Task DeleteAsync(Guid tenantId, Guid id);
}
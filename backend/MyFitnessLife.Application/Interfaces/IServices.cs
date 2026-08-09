using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.DTOs.Auth;
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
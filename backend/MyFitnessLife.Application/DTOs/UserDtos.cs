using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.Application.DTOs.Users;

public class InviteUserRequest
{
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
}

public class InviteUserResponse
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public class AcceptInvitationRequest
{
    public string Token { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class UpdateUserRoleRequest
{
    public Guid UserId { get; set; }
    public UserRole Role { get; set; }
}

public class UserListItemDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid? TenantId { get; set; }
    public DateTime? LastLoginAt { get; set; }
}
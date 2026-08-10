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
    public DateTime? SentAt { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
}

public class InvitationDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
    public bool Expired { get; set; }
}

public class InvitationInfoDto
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool Valid { get; set; }
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
using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.Application.DTOs.Auth;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class GoogleLoginRequest
{
    public string IdToken { get; set; } = string.Empty;
}

public class RegisterRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? InvitationToken { get; set; }
}

public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    UserDto User);

/// <summary>Role y TenantId son los de la membresía actual (MembershipId).</summary>
public record UserDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    Guid? TenantId,
    string Role,
    string Status,
    string FullName,
    Guid? MembershipId,
    IReadOnlyList<MembershipDto> Memberships)
{
    /// <summary>Suscripción del tenant de la membresía actual; null si la membresía no tiene tenant (SuperAdmin).</summary>
    public UserSubscriptionDto? Subscription { get; init; }
}

/// <summary>Estado de la suscripción del tenant actual. Status: Active | ExpiringSoon | Expired | None.</summary>
public class UserSubscriptionDto
{
    /// <summary>null si el tenant no tiene ninguna suscripción (Status = None).</summary>
    public string? PlanName { get; set; }
    public DateTime? EndsAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public int DaysLeft { get; set; }
}

public class MembershipDto
{
    public Guid Id { get; set; }
    public Guid? TenantId { get; set; }
    public string? TenantName { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? LastUsedAt { get; set; }
}

/// <summary>Respuesta de login cuando el usuario tiene más de una membresía activa (sin tokens).</summary>
public class MembershipSelectionResponse
{
    public bool RequiresMembershipSelection { get; set; } = true;
    public string SelectionToken { get; set; } = string.Empty;
    public IReadOnlyList<MembershipDto> Memberships { get; set; } = [];
}

/// <summary>Resultado interno de login: exactamente uno de los dos está informado.</summary>
public class LoginResult
{
    public AuthResponse? Auth { get; init; }
    public MembershipSelectionResponse? Selection { get; init; }
}

public class SelectMembershipRequest
{
    public string SelectionToken { get; set; } = string.Empty;
    public Guid MembershipId { get; set; }
}

public class SwitchMembershipRequest
{
    public Guid MembershipId { get; set; }
    /// <summary>Opcional: refresh token actual a revocar. Si falta, se revocan los del perfil actual.</summary>
    public string? RefreshToken { get; set; }
}

public record TokenResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt);
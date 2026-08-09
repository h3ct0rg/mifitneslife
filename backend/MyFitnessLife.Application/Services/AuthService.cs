using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IGoogleAuthService _googleAuthService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITenantActivityService _activityService;

    public AuthService(
        IUnitOfWork unitOfWork,
        ITokenService tokenService,
        IGoogleAuthService googleAuthService,
        IPasswordHasher passwordHasher,
        ITenantActivityService activityService)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _googleAuthService = googleAuthService;
        _passwordHasher = passwordHasher;
        _activityService = activityService;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await _unitOfWork.Users.GetByEmailAsync(request.Email.Trim().ToLowerInvariant());
        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash!))
            throw new UnauthorizedAccessException("Credenciales inválidas.");

        if (user.Status is not UserStatus.Active)
            throw new UnauthorizedAccessException("El usuario está desactivado o pendiente de invitación.");

        user.LastLoginAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.Users.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        var tokens = await _tokenService.CreateTokenPairAsync(user.Id);
        await _activityService.RecordLoginAsync(user.TenantId, user.Email);
        await _unitOfWork.SaveChangesAsync();

        return BuildResponse(user, tokens);
    }

    public async Task<AuthResponse> GoogleLoginAsync(GoogleLoginRequest request)
    {
        var payload = await _googleAuthService.ValidateIdTokenAsync(request.IdToken);

        var user = await _unitOfWork.Users.GetByGoogleSubjectAsync(payload.Subject);
        if (user is null)
        {
            user = await _unitOfWork.Users.GetByEmailAsync(payload.Email);
            if (user is null)
            {
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = payload.Email,
                    Email = payload.Email,
                    NormalizedEmail = payload.Email.ToUpperInvariant(),
                    NormalizedUserName = payload.Email.ToUpperInvariant(),
                    FirstName = payload.FirstName,
                    LastName = payload.LastName,
                    Role = UserRole.Patient,
                    Status = UserStatus.Active,
                    Provider = "Google",
                    GoogleSubject = payload.Subject,
                    EmailConfirmed = true,
                    LastLoginAt = DateTime.UtcNow
                };
                await _unitOfWork.Users.AddAsync(user);
            }
            else
            {
                user.Provider = "Google";
                user.GoogleSubject = payload.Subject;
                user.EmailConfirmed = true;
            }
        }

        user.LastLoginAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.Users.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        var tokens = await _tokenService.CreateTokenPairAsync(user.Id);
        await _activityService.RecordLoginAsync(user.TenantId, user.Email);
        await _unitOfWork.SaveChangesAsync();

        return BuildResponse(user, tokens);
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await _unitOfWork.Users.EmailExistsAsync(email))
            throw new InvalidOperationException("El email ya está registrado.");

        UserRole role = UserRole.Patient;
        Guid? tenantId = null;

        if (!string.IsNullOrWhiteSpace(request.InvitationToken))
        {
            var invitation = await _unitOfWork.Invitations.GetByTokenAsync(request.InvitationToken);
            if (invitation is null || invitation.Status != InvitationStatus.Pending)
                throw new InvalidOperationException("La invitación no es válida o ya fue utilizada.");
            if (invitation.ExpiresAt < DateTime.UtcNow)
                throw new InvalidOperationException("La invitación expiró.");

            role = invitation.Role;
            tenantId = invitation.TenantId;
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            FirstName = request.FirstName,
            LastName = request.LastName,
            PasswordHash = _passwordHasher.Hash(request.Password),
            Role = role,
            TenantId = tenantId,
            Status = UserStatus.Active,
            LastLoginAt = DateTime.UtcNow
        };

        await _unitOfWork.Users.AddAsync(user);
        await _unitOfWork.SaveChangesAsync();

        var tokens = await _tokenService.CreateTokenPairAsync(user.Id);
        await _activityService.RecordLoginAsync(user.TenantId, user.Email);
        await _unitOfWork.SaveChangesAsync();

        return BuildResponse(user, tokens);
    }

    public async Task<AuthResponse> RefreshTokenAsync(string refreshToken)
    {
        var stored = await _unitOfWork.RefreshTokens.GetByTokenAsync(refreshToken);
        if (stored is null || stored.IsRevoked || stored.IsUsed || stored.ExpiresAt < DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token inválido o expirado.");

        var user = await _unitOfWork.Users.GetByIdAsync(stored.UserId);
        if (user is null || user.Status is not UserStatus.Active)
            throw new UnauthorizedAccessException("Usuario no encontrado o desactivado.");

        stored.IsUsed = true;
        await _unitOfWork.RefreshTokens.UpdateAsync(stored);

        var tokens = await _tokenService.CreateTokenPairAsync(user.Id);
        await _unitOfWork.SaveChangesAsync();

        return BuildResponse(user, tokens);
    }

    public async Task LogoutAsync(Guid userId)
    {
        await _unitOfWork.RefreshTokens.RevokeAllForUserAsync(userId);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<UserDto> GetUserByIdAsync(Guid id)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        return new UserDto(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email!,
            user.TenantId,
            user.Role.ToString(),
            user.Status.ToString(),
            user.FullName);
    }

    private AuthResponse BuildResponse(ApplicationUser user, TokenResponse tokens)
    {
        var dto = new UserDto(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email!,
            user.TenantId,
            user.Role.ToString(),
            user.Status.ToString(),
            user.FullName);

        return new AuthResponse(tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresAt, dto);
    }
}
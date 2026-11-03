using System.Security.Cryptography;
using System.Text;
using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Application.Exceptions;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class AuthService : IAuthService
{
    private static readonly TimeSpan SelectionTokenLifetime = TimeSpan.FromMinutes(5);

    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IGoogleAuthService _googleAuthService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITenantActivityService _activityService;
    private readonly ILoginEventRecorder _loginEvents;

    public AuthService(
        IUnitOfWork unitOfWork,
        ITokenService tokenService,
        IGoogleAuthService googleAuthService,
        IPasswordHasher passwordHasher,
        ITenantActivityService activityService,
        ILoginEventRecorder loginEvents)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _googleAuthService = googleAuthService;
        _passwordHasher = passwordHasher;
        _activityService = activityService;
        _loginEvents = loginEvents;
    }

    // ───────────────────────────── Login ─────────────────────────────

    public async Task<LoginResult> LoginAsync(LoginRequest request)
    {
        var user = await _unitOfWork.Users.GetByEmailAsync(request.Email.Trim().ToLowerInvariant());
        if (user is null || string.IsNullOrEmpty(user.PasswordHash) || !_passwordHasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Credenciales inválidas.");

        if (user.Status is not UserStatus.Active)
            throw new UnauthorizedAccessException("El usuario está desactivado o pendiente de invitación.");

        user.LastLoginAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        return await CompleteLoginAsync(user, LoginMethod.Password);
    }

    public async Task<LoginResult> GoogleLoginAsync(GoogleLoginRequest request)
    {
        var payload = await _googleAuthService.ValidateIdTokenAsync(request.IdToken);
        var touchedMemberships = false;

        var user = await _unitOfWork.Users.GetByGoogleSubjectAsync(payload.Subject);
        if (user is null)
        {
            user = await _unitOfWork.Users.GetByEmailAsync(payload.Email);
            if (user is null)
            {
                // Invitación pendiente → su rol y tenant; si no, el usuario crea y administra su propio tenant.
                var invitation = await FindPendingInvitationAsync(payload.Email);
                var newUserId = Guid.NewGuid();
                UserRole role;
                Guid? tenantId;

                if (invitation is not null)
                {
                    role = invitation.Role;
                    tenantId = invitation.TenantId;
                }
                else
                {
                    var ownTenant = await CreateTenantForNewUserAsync(newUserId, payload.FirstName, payload.LastName, payload.Email);
                    role = UserRole.Admin;
                    tenantId = ownTenant.Id;
                }

                user = new ApplicationUser
                {
                    Id = newUserId,
                    UserName = payload.Email,
                    Email = payload.Email,
                    NormalizedEmail = payload.Email.ToUpperInvariant(),
                    NormalizedUserName = payload.Email.ToUpperInvariant(),
                    FirstName = payload.FirstName,
                    LastName = payload.LastName,
                    Role = role,
                    TenantId = tenantId,
                    Status = UserStatus.Active,
                    Provider = "Google",
                    GoogleSubject = payload.Subject,
                    EmailConfirmed = true,
                    LastLoginAt = DateTime.UtcNow
                };
                await _unitOfWork.Users.AddAsync(user);
                await _unitOfWork.Memberships.AddAsync(new UserMembership { UserId = user.Id, TenantId = tenantId, Role = role });
                touchedMemberships = true;

                if (invitation is not null)
                    MarkAccepted(invitation);

                if (tenantId.HasValue && role == UserRole.Patient)
                    await PatientProfiles.EnsureAsync(_unitOfWork, tenantId.Value, payload.Email, payload.FirstName, payload.LastName);
            }
            else
            {
                user.Provider = "Google";
                user.GoogleSubject = payload.Subject;
                user.EmailConfirmed = true;

                // D6: una invitación pendiente AGREGA la membresía; nunca sobrescribe las existentes.
                var invitation = await FindPendingInvitationAsync(payload.Email);
                if (invitation is not null)
                {
                    touchedMemberships = await AddMembershipFromInvitationAsync(user, invitation);
                    MarkAccepted(invitation);
                }
            }
        }

        if (user.Status is not UserStatus.Active)
            throw new UnauthorizedAccessException("El usuario está desactivado o pendiente de invitación.");

        user.LastLoginAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        // Usuario trackeado (Added o cargado): SaveChanges hace INSERT/UPDATE sin UpdateAsync.
        await _unitOfWork.SaveChangesAsync();

        if (touchedMemberships)
        {
            await MembershipHelper.SyncIdentityRolesAsync(_unitOfWork, user.Id);
            await _unitOfWork.SaveChangesAsync();
        }

        return await CompleteLoginAsync(user, LoginMethod.Google);
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await _unitOfWork.Users.EmailExistsAsync(email))
            throw new InvalidOperationException("El email ya está registrado.");

        UserRole role;
        Guid? tenantId;
        Invitation? invitation = null;
        var newUserId = Guid.NewGuid();

        if (!string.IsNullOrWhiteSpace(request.InvitationToken))
        {
            invitation = await _unitOfWork.Invitations.GetByTokenAsync(request.InvitationToken);
            if (invitation is null || invitation.Status != InvitationStatus.Pending)
                throw new InvalidOperationException("La invitación no es válida o ya fue utilizada.");
            if (invitation.ExpiresAt < DateTime.UtcNow)
                throw new InvalidOperationException("La invitación expiró.");
            if (invitation.Role == UserRole.SuperAdmin)
                throw new InvalidOperationException("La invitación no es válida.");

            role = invitation.Role;
            tenantId = invitation.TenantId;
        }
        else
        {
            // Sin invitación: el usuario crea y administra su propio tenant.
            var ownTenant = await CreateTenantForNewUserAsync(newUserId, request.FirstName, request.LastName, email);
            role = UserRole.Admin;
            tenantId = ownTenant.Id;
        }

        var user = new ApplicationUser
        {
            Id = newUserId,
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

        var membership = new UserMembership { UserId = user.Id, TenantId = tenantId, Role = role };
        await _unitOfWork.Users.AddAsync(user);
        await _unitOfWork.Memberships.AddAsync(membership);

        if (invitation is not null)
            MarkAccepted(invitation);

        if (role == UserRole.Patient && tenantId.HasValue)
            await PatientProfiles.EnsureAsync(_unitOfWork, tenantId.Value, email, request.FirstName, request.LastName);

        await _unitOfWork.SaveChangesAsync();
        await MembershipHelper.SyncIdentityRolesAsync(_unitOfWork, user.Id);
        await _unitOfWork.SaveChangesAsync();

        return await IssueAsync(user, membership, LoginMethod.Register);
    }

    // ───────────────────────────── Membresías ─────────────────────────────

    public async Task<AuthResponse> SelectMembershipAsync(SelectMembershipRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SelectionToken))
            throw new UnauthorizedAccessException("Token de selección inválido o expirado.");

        // Un solo uso, atómico: se consume antes de validar la membresía (un intento fallido obliga
        // a reloguear) y dos peticiones simultáneas no pueden canjear el mismo token.
        var tokenHash = Hash(request.SelectionToken);
        var userId = await _unitOfWork.SelectionTokens.TryConsumeAsync(tokenHash, DateTime.UtcNow)
            ?? throw new UnauthorizedAccessException("Token de selección inválido o expirado.");
        // Método del login original (password/Google) para el LoginEvent; tokens previos → Password.
        var method = (await _unitOfWork.SelectionTokens.GetByHashAsync(tokenHash))?.Method ?? LoginMethod.Password;

        var user = await _unitOfWork.Users.GetByIdAsync(userId);
        if (user is null || user.Status is not UserStatus.Active)
            throw new UnauthorizedAccessException("Usuario no encontrado o desactivado.");

        var membership = await RequireUsableMembershipAsync(user.Id, request.MembershipId);
        return await IssueAsync(user, membership, method);
    }

    public async Task<AuthResponse> SwitchMembershipAsync(Guid userId, Guid? currentMembershipId, SwitchMembershipRequest request)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(userId);
        if (user is null || user.Status is not UserStatus.Active)
            throw new UnauthorizedAccessException("Usuario no encontrado o desactivado.");

        var membership = await RequireUsableMembershipAsync(user.Id, request.MembershipId);

        // Revoca el refresh token de la sesión actual: el indicado o, si no llega, los del perfil actual.
        var revoked = false;
        if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            var current = await _unitOfWork.RefreshTokens.GetByTokenAsync(request.RefreshToken);
            if (current is not null && current.UserId == user.Id && !current.IsRevoked)
            {
                current.IsRevoked = true;
                current.RevokedReason = "switched_membership";
                await _unitOfWork.RefreshTokens.UpdateAsync(current);
                revoked = true;
            }
        }
        if (!revoked)
            await _unitOfWork.RefreshTokens.RevokeForMembershipAsync(user.Id, currentMembershipId, "switched_membership");

        return await IssueAsync(user, membership, loginMethod: null);
    }

    public async Task<AuthResponse> RefreshTokenAsync(string refreshToken)
    {
        var stored = await _unitOfWork.RefreshTokens.GetByTokenAsync(refreshToken);
        if (stored is null || stored.IsRevoked || stored.IsUsed || stored.ExpiresAt < DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token inválido o expirado.");

        var user = await _unitOfWork.Users.GetByIdAsync(stored.UserId);
        if (user is null || user.Status is not UserStatus.Active)
            throw new UnauthorizedAccessException("Usuario no encontrado o desactivado.");

        // Conserva la membresía del refresh token; los tokens antiguos (sin membresía) usan la por defecto.
        var usable = await _unitOfWork.Memberships.GetByUserAsync(user.Id, usableOnly: true);
        var membership = stored.MembershipId.HasValue
            ? usable.FirstOrDefault(m => m.Id == stored.MembershipId.Value)
            : MembershipHelper.ResolveDefault(user, usable);
        if (membership is null)
            throw new UnauthorizedAccessException("El perfil de la sesión ya no está disponible. Inicia sesión de nuevo.");

        stored.IsUsed = true;
        await _unitOfWork.RefreshTokens.UpdateAsync(stored);

        var tokens = await _tokenService.CreateTokenPairAsync(user.Id, membership.Id);
        await _unitOfWork.SaveChangesAsync();

        // AC-11: un evento Session por usuario y día UTC (usuarios que vuelven sin re-loguear).
        await _loginEvents.RecordSessionIfFirstTodayAsync(user.Id, membership);

        return new AuthResponse(tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresAt,
            await MembershipHelper.BuildUserDtoAsync(_unitOfWork, user, membership.Id));
    }

    public async Task LogoutAsync(Guid userId)
    {
        await _unitOfWork.RefreshTokens.RevokeAllForUserAsync(userId);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<UserDto> GetUserByIdAsync(Guid id, Guid? currentMembershipId = null)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");
        return await MembershipHelper.BuildUserDtoAsync(_unitOfWork, user, currentMembershipId);
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    /// <summary>D4: 1 membresía utilizable → tokens; >1 → selección; 0 → 403.</summary>
    private async Task<LoginResult> CompleteLoginAsync(ApplicationUser user, LoginMethod method)
    {
        var usable = await _unitOfWork.Memberships.GetByUserAsync(user.Id, usableOnly: true);

        if (usable.Count == 0)
            throw new ForbiddenException("No tienes ningún perfil activo. Contacta al administrador.");

        if (usable.Count == 1)
            return new LoginResult { Auth = await IssueAsync(user, usable[0], method) };

        var rawToken = GenerateSelectionToken();
        await _unitOfWork.SelectionTokens.AddAsync(new LoginSelectionToken
        {
            UserId = user.Id,
            TokenHash = Hash(rawToken),
            ExpiresAt = DateTime.UtcNow.Add(SelectionTokenLifetime),
            Method = method
        });
        await _unitOfWork.SaveChangesAsync();

        return new LoginResult
        {
            Selection = new MembershipSelectionResponse
            {
                RequiresMembershipSelection = true,
                SelectionToken = rawToken,
                Memberships = usable.Select(MembershipHelper.ToDto).ToList()
            }
        };
    }

    /// <summary>
    /// Emite tokens para la membresía, actualiza LastUsedAt y el espejo (D3). Con loginMethod
    /// (login completado) registra la actividad y el LoginEvent (AC-11); null = cambio de perfil.
    /// </summary>
    private async Task<AuthResponse> IssueAsync(ApplicationUser user, UserMembership membership, LoginMethod? loginMethod)
    {
        membership.LastUsedAt = DateTime.UtcNow;
        MembershipHelper.ApplyMirror(user, membership);
        await _unitOfWork.SaveChangesAsync();

        var tokens = await _tokenService.CreateTokenPairAsync(user.Id, membership.Id);
        if (loginMethod.HasValue)
            await _activityService.RecordLoginAsync(membership.TenantId, user.Email ?? string.Empty);
        await _unitOfWork.SaveChangesAsync();

        // Después del último SaveChanges: guarda solo el evento y nunca lanza.
        if (loginMethod.HasValue)
            await _loginEvents.RecordAsync(user.Id, membership, loginMethod.Value);

        return new AuthResponse(tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresAt,
            await MembershipHelper.BuildUserDtoAsync(_unitOfWork, user, membership.Id));
    }

    /// <summary>AC-6: la membresía debe ser del usuario, activa y de tenant activo.</summary>
    private async Task<UserMembership> RequireUsableMembershipAsync(Guid userId, Guid membershipId)
    {
        var membership = await _unitOfWork.Memberships.GetByIdAsync(membershipId);
        if (membership is null || membership.UserId != userId || !MembershipHelper.IsUsable(membership))
            throw new ForbiddenException("El perfil seleccionado no está disponible.");
        return membership;
    }

    /// <summary>Agrega la membresía de la invitación si no existe (Patient → ficha). Devuelve true si la agregó.</summary>
    private async Task<bool> AddMembershipFromInvitationAsync(ApplicationUser user, Invitation invitation)
    {
        if (await _unitOfWork.Memberships.FindAsync(user.Id, invitation.TenantId, invitation.Role) is not null)
            return false;

        await _unitOfWork.Memberships.AddAsync(new UserMembership
        {
            UserId = user.Id,
            TenantId = invitation.TenantId,
            Role = invitation.Role
        });

        if (invitation.Role == UserRole.Patient)
            await PatientProfiles.EnsureAsync(_unitOfWork, invitation.TenantId, user.Email!, user.FirstName, user.LastName);

        return true;
    }

    private void MarkAccepted(Invitation invitation)
    {
        invitation.Status = InvitationStatus.Accepted;
        invitation.AcceptedAt = DateTime.UtcNow;
    }

    private async Task<Tenant> CreateTenantForNewUserAsync(Guid ownerId, string firstName, string lastName, string email)
    {
        var name = $"{firstName} {lastName}".Trim();
        if (string.IsNullOrWhiteSpace(name))
            name = email.Split('@')[0];

        var baseSlug = name.Trim().ToLowerInvariant().Replace(" ", "-");
        var slug = baseSlug;
        var attempt = 1;
        while (await _unitOfWork.Tenants.GetBySlugAsync(slug) is not null)
            slug = $"{baseSlug}-{++attempt}";

        var tenant = new Tenant
        {
            Name = name,
            Slug = slug,
            IsActive = true,
            OwnedBy = ownerId
        };
        await _unitOfWork.Tenants.AddAsync(tenant);
        // AC-3: todo tenant nuevo arranca con el plan de prueba.
        await SubscriptionHelper.StartTrialAsync(_unitOfWork, tenant.Id);
        return tenant;
    }

    private async Task<Invitation?> FindPendingInvitationAsync(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        var tenants = await _unitOfWork.Tenants.GetAllAsync();
        foreach (var tenant in tenants)
        {
            var invitation = await _unitOfWork.Invitations.GetPendingByEmailAsync(tenant.Id, normalized);
            // Una invitación nunca puede otorgar SuperAdmin.
            if (invitation is not null && invitation.ExpiresAt >= DateTime.UtcNow
                && invitation.Role != UserRole.SuperAdmin)
                return invitation;
        }
        return null;
    }

    private static string GenerateSelectionToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string Hash(string token)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

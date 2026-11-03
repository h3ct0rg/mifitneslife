using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Application.DTOs.Users;
using MyFitnessLife.Application.Exceptions;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class UserManagementService : IUserManagementService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITenantActivityService _activityService;
    private readonly InvitationDispatcher _invitations;

    public UserManagementService(
        IUnitOfWork unitOfWork,
        ITenantActivityService activityService,
        InvitationDispatcher invitations)
    {
        _unitOfWork = unitOfWork;
        _activityService = activityService;
        _invitations = invitations;
    }

    public async Task<InviteUserResponse> InviteUserAsync(Guid inviterId, Guid tenantId, InviteUserRequest request)
    {
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId);
        if (tenant is null)
            throw new KeyNotFoundException("Tenant no encontrado.");

        if (request.Role is not { } role || !Enum.IsDefined(role))
            throw new ArgumentException("Debes indicar un rol válido para la invitación.");
        if (role == UserRole.SuperAdmin)
            throw new ArgumentException("No se puede invitar a un usuario con rol SuperAdmin.");

        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (!InvitationDispatcher.IsValidEmail(email))
            throw new ArgumentException("El email no es válido.");

        // D6: se permite invitar a cuentas existentes (al aceptar se agrega la membresía);
        // solo la misma membresía (tenant + rol) es conflicto.
        if (await _invitations.HasMembershipAsync(email, tenantId, role))
            throw new ConflictException("Ese usuario ya tiene ese rol en este centro.");

        var existing = await _unitOfWork.Invitations.GetPendingByEmailAndRoleAsync(tenantId, email, role);
        if (existing is not null)
            throw new InvalidOperationException("Ya existe una invitación pendiente para ese email y rol.");

        var invitation = await _invitations.CreateAsync(tenant, email, role, inviterId);

        return ToInviteResponse(invitation);
    }

    public async Task<InvitationInfoDto> GetInvitationInfoAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("Token inválido.");

        var invitation = await _unitOfWork.Invitations.GetByTokenAsync(token);
        if (invitation is null || invitation.Status != InvitationStatus.Pending)
            return new InvitationInfoDto { Valid = false };

        var expired = invitation.ExpiresAt < DateTime.UtcNow;
        if (expired)
        {
            invitation.Status = InvitationStatus.Expired;
            invitation.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.Invitations.UpdateAsync(invitation);
            await _unitOfWork.SaveChangesAsync();
            return new InvitationInfoDto { Valid = false };
        }

        var tenant = await _unitOfWork.Tenants.GetByIdAsync(invitation.TenantId);

        return new InvitationInfoDto
        {
            Valid = true,
            Email = invitation.Email,
            Role = invitation.Role.ToString(),
            TenantName = tenant?.Name ?? "el centro",
            ExpiresAt = invitation.ExpiresAt,
            ExistingAccount = await _unitOfWork.Users.EmailExistsAsync(invitation.Email)
        };
    }

    public async Task<IEnumerable<InvitationDto>> GetInvitationsAsync(Guid tenantId)
    {
        var invitations = await _unitOfWork.Invitations.GetByTenantAsync(tenantId);
        var now = DateTime.UtcNow;

        return invitations
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new InvitationDto
            {
                Id = i.Id,
                Email = i.Email,
                Role = i.Role.ToString(),
                Status = i.Status == InvitationStatus.Pending && i.ExpiresAt < now
                    ? InvitationStatus.Expired.ToString()
                    : i.Status.ToString(),
                Token = i.Token,
                ExpiresAt = i.ExpiresAt,
                SentAt = i.SentAt,
                AcceptedAt = i.AcceptedAt,
                Attempts = i.Attempts,
                LastError = i.LastError,
                Expired = i.Status == InvitationStatus.Pending && i.ExpiresAt < now
            });
    }

    public async Task<InvitationDto> ResendInvitationAsync(Guid tenantId, Guid invitationId)
    {
        var invitation = await _unitOfWork.Invitations.GetByIdAsync(invitationId)
            ?? throw new KeyNotFoundException("Invitación no encontrada.");
        if (invitation.TenantId != tenantId)
            throw new UnauthorizedAccessException("Acceso denegado.");

        if (invitation.Status == InvitationStatus.Accepted)
            throw new InvalidOperationException("La invitación ya fue aceptada.");

        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId)
            ?? throw new KeyNotFoundException("Tenant no encontrado.");

        // Nuevo token y vencimiento para el enlace reenviado.
        await _invitations.ResendAsync(tenant, invitation);

        return ToInvitationDto(invitation);
    }

    public async Task<InvitationDto> RevokeInvitationAsync(Guid tenantId, Guid invitationId)
    {
        var invitation = await _unitOfWork.Invitations.GetByIdAsync(invitationId)
            ?? throw new KeyNotFoundException("Invitación no encontrada.");
        if (invitation.TenantId != tenantId)
            throw new UnauthorizedAccessException("Acceso denegado.");

        if (invitation.Status == InvitationStatus.Accepted)
            throw new InvalidOperationException("No se puede revocar una invitación aceptada.");

        invitation.Status = InvitationStatus.Revoked;
        invitation.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Invitations.UpdateAsync(invitation);
        await _unitOfWork.SaveChangesAsync();

        return ToInvitationDto(invitation);
    }

    /// <summary>
    /// Cuenta existente (autenticada) acepta una invitación: se AGREGA la membresía (D6), nunca se
    /// sobrescriben datos ni otras membresías. Idempotente si ya la tenía.
    /// </summary>
    public async Task<MembershipDto> AcceptInvitationAsync(Guid userId, AcceptInvitationRequest request)
    {
        var invitation = await _unitOfWork.Invitations.GetByTokenAsync(request.Token);
        if (invitation is null || invitation.Status != InvitationStatus.Pending)
            throw new InvalidOperationException("La invitación no es válida o ya fue utilizada.");
        if (invitation.ExpiresAt < DateTime.UtcNow)
            throw new InvalidOperationException("La invitación expiró.");
        if (invitation.Role == UserRole.SuperAdmin)
            throw new InvalidOperationException("La invitación no es válida.");

        var user = await _unitOfWork.Users.GetByIdAsync(userId)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        if (!string.Equals(user.Email, invitation.Email, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("La invitación no corresponde al email del usuario.");

        var membership = await _unitOfWork.Memberships.FindAsync(user.Id, invitation.TenantId, invitation.Role);
        var added = membership is null;
        if (membership is null)
        {
            membership = new UserMembership
            {
                UserId = user.Id,
                TenantId = invitation.TenantId,
                Role = invitation.Role
            };
            await _unitOfWork.Memberships.AddAsync(membership);

            if (invitation.Role == UserRole.Patient)
                await PatientProfiles.EnsureAsync(_unitOfWork, invitation.TenantId, user.Email!, user.FirstName, user.LastName);
        }

        invitation.Status = InvitationStatus.Accepted;
        invitation.AcceptedAt = DateTime.UtcNow;
        await _activityService.RecordEntityAsync(invitation.TenantId, "accept_invitation", "User", user.Id.ToString(), user.Email);
        await _unitOfWork.SaveChangesAsync();

        if (added)
        {
            await MembershipHelper.SyncIdentityRolesAsync(_unitOfWork, user.Id);
            await _unitOfWork.SaveChangesAsync();
        }

        membership.Tenant ??= await _unitOfWork.Tenants.GetByIdAsync(invitation.TenantId);
        return MembershipHelper.ToDto(membership);
    }

    /// <summary>
    /// Cambia el rol de la membresía del usuario en el tenant del llamante. Si el usuario tiene
    /// varias membresías en este tenant, se debe gestionar desde SuperAdmin (ambigüedad).
    /// </summary>
    public async Task UpdateUserRoleAsync(Guid actorId, Guid tenantId, UpdateUserRoleRequest request)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId);
        var inTenant = user is null
            ? []
            : (await _unitOfWork.Memberships.GetByUserAsync(user.Id)).Where(m => m.TenantId == tenantId).ToList();
        // El usuario objetivo debe pertenecer al tenant del llamante; si no, se responde como
        // inexistente para no filtrar usuarios de otros tenants.
        if (user is null || inTenant.Count == 0)
            throw new KeyNotFoundException("Usuario no encontrado.");

        if (request.Role == UserRole.SuperAdmin)
            throw new UnauthorizedAccessException("No se puede asignar el rol super admin.");

        if (inTenant.Any(m => m.Role == request.Role))
            return; // Ya tiene ese rol en el tenant.

        if (inTenant.Count > 1)
            throw new UnauthorizedAccessException("El usuario tiene varios perfiles en este centro; gestiónalo desde el panel de plataforma.");

        var membership = inTenant[0];
        var wasDefault = user.Role == membership.Role && user.TenantId == membership.TenantId;
        membership.Role = request.Role;
        if (wasDefault)
            MembershipHelper.ApplyMirror(user, membership);

        if (request.Role == UserRole.Patient)
            await PatientProfiles.EnsureAsync(_unitOfWork, tenantId, user.Email!, user.FirstName, user.LastName);

        await _activityService.RecordEntityAsync(tenantId, "assign_role", "User", user.Id.ToString(), user.Email);
        await _unitOfWork.SaveChangesAsync();
        await MembershipHelper.SyncIdentityRolesAsync(_unitOfWork, user.Id);
        await _unitOfWork.SaveChangesAsync();
    }

    /// <summary>D7: usuarios del tenant = usuarios con membresía en él (rol = el de esa membresía).</summary>
    public async Task<IEnumerable<UserListItemDto>> GetTenantUsersAsync(Guid tenantId)
    {
        var memberships = await _unitOfWork.Memberships.GetByTenantAsync(tenantId);
        return memberships
            .Where(m => m.User is not null)
            .GroupBy(m => m.UserId)
            .Select(g =>
            {
                var m = g.OrderBy(x => x.Role).First(); // Varias en el mismo tenant → la de mayor rango.
                var u = m.User!;
                return new UserListItemDto
                {
                    Id = u.Id,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    Email = u.Email ?? string.Empty,
                    Role = m.Role.ToString(),
                    Status = u.Status.ToString(),
                    TenantId = tenantId,
                    LastLoginAt = u.LastLoginAt
                };
            })
            .ToList();
    }

    public async Task<UserDto> GetUserByIdAsync(Guid id, Guid? currentMembershipId = null)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");
        return await MembershipHelper.BuildUserDtoAsync(_unitOfWork, user, currentMembershipId);
    }


    private static InviteUserResponse ToInviteResponse(Invitation i)
        => new()
        {
            Id = i.Id,
            Email = i.Email,
            Role = i.Role.ToString(),
            Status = i.Status.ToString(),
            Token = i.Token,
            ExpiresAt = i.ExpiresAt,
            SentAt = i.SentAt,
            Attempts = i.Attempts,
            LastError = i.LastError
        };

    private static InvitationDto ToInvitationDto(Invitation i)
        => new()
        {
            Id = i.Id,
            Email = i.Email,
            Role = i.Role.ToString(),
            Status = i.Status.ToString(),
            Token = i.Token,
            ExpiresAt = i.ExpiresAt,
            SentAt = i.SentAt,
            AcceptedAt = i.AcceptedAt,
            Attempts = i.Attempts,
            LastError = i.LastError,
            Expired = false
        };
}
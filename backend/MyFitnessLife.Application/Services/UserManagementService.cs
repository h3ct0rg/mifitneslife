using Microsoft.Extensions.Configuration;
using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Application.DTOs.Users;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Application.Mapping;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;
using System.Net.Mail;

namespace MyFitnessLife.Application.Services;

public class UserManagementService : IUserManagementService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITenantActivityService _activityService;
    private readonly IEmailService _emailService;
    private readonly string _frontendUrl;

    public UserManagementService(
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        ITenantActivityService activityService,
        IEmailService emailService,
        IConfiguration configuration)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _activityService = activityService;
        _emailService = emailService;
        _frontendUrl = configuration["FrontendUrl"]?.TrimEnd('/') ?? "http://localhost:5173";
    }

    public async Task<InviteUserResponse> InviteUserAsync(Guid inviterId, Guid tenantId, InviteUserRequest request)
    {
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId);
        if (tenant is null)
            throw new KeyNotFoundException("Tenant no encontrado.");

        var email = request.Email.Trim().ToLowerInvariant();
        if (!IsValidEmail(email))
            throw new ArgumentException("El email no es válido.");

        if (await _unitOfWork.Users.EmailExistsAsync(email))
            throw new InvalidOperationException("Ya existe un usuario con ese email.");

        var existing = await _unitOfWork.Invitations.GetPendingByEmailAsync(tenantId, email);
        if (existing is not null)
            throw new InvalidOperationException("Ya existe una invitación pendiente para ese email.");

        var invitation = new Invitation
        {
            TenantId = tenantId,
            Email = email,
            Role = request.Role,
            InvitedBy = inviterId,
            Token = Guid.NewGuid().ToString("N"),
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            Status = InvitationStatus.Pending
        };

        await _unitOfWork.Invitations.AddAsync(invitation);
        await _activityService.RecordEntityAsync(tenantId, "invite", "User", invitation.Id.ToString(), email);
        await _unitOfWork.SaveChangesAsync();

        await EnqueueInvitationEmailAsync(tenant, invitation);

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
            ExpiresAt = invitation.ExpiresAt
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

        // Nuevo token y vencimiento para el enlace reenviado.
        invitation.Token = Guid.NewGuid().ToString("N");
        invitation.ExpiresAt = DateTime.UtcNow.AddHours(24);
        invitation.Status = InvitationStatus.Pending;
        invitation.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Invitations.UpdateAsync(invitation);
        await _unitOfWork.SaveChangesAsync();

        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId);
        await EnqueueInvitationEmailAsync(tenant!, invitation);

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

    public async Task AcceptInvitationAsync(Guid userId, AcceptInvitationRequest request)
    {
        var invitation = await _unitOfWork.Invitations.GetByTokenAsync(request.Token);
        if (invitation is null || invitation.Status != InvitationStatus.Pending)
            throw new InvalidOperationException("La invitación no es válida o ya fue utilizada.");
        if (invitation.ExpiresAt < DateTime.UtcNow)
            throw new InvalidOperationException("La invitación expiró.");

        var user = await _unitOfWork.Users.GetByIdAsync(userId);
        if (user is null)
            throw new KeyNotFoundException("Usuario no encontrado.");

        if (!string.Equals(user.Email, invitation.Email, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("La invitación no corresponde al email del usuario.");

        user.FirstName = request.FirstName;
        user.LastName = request.LastName;
        user.PasswordHash = _passwordHasher.Hash(request.Password);
        user.TenantId = invitation.TenantId;
        user.Role = invitation.Role;
        user.Status = UserStatus.Active;
        user.UpdatedAt = DateTime.UtcNow;

        invitation.Status = InvitationStatus.Accepted;
        invitation.AcceptedAt = DateTime.UtcNow;

        await _unitOfWork.Users.UpdateAsync(user);
        await _unitOfWork.Invitations.UpdateAsync(invitation);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task UpdateUserRoleAsync(Guid actorId, UpdateUserRoleRequest request)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId);
        if (user is null)
            throw new KeyNotFoundException("Usuario no encontrado.");

        if (user.Role == UserRole.SuperAdmin)
            throw new UnauthorizedAccessException("No se puede modificar un super admin.");

        user.Role = request.Role;
        user.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Users.UpdateAsync(user);
        await _activityService.RecordEntityAsync(user.TenantId!.Value, "assign_role", "User", user.Id.ToString(), user.Email);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<IEnumerable<UserListItemDto>> GetTenantUsersAsync(Guid tenantId)
    {
        var users = await _unitOfWork.Users.GetByTenantAsync(tenantId);
        return users.Select(u => u.ToUserListItem());
    }

    public async Task<UserDto> GetUserByIdAsync(Guid id)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id);
        if (user is null)
            throw new KeyNotFoundException("Usuario no encontrado.");

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

    private async Task EnqueueInvitationEmailAsync(Tenant tenant, Invitation invitation)
    {
        var acceptUrl = $"{_frontendUrl}/registro?token={invitation.Token}";
        var html = _emailService.BuildInvitationEmail(
            invitation.Email,
            invitation.Email,
            tenant.Name,
            RoleLabel(invitation.Role),
            acceptUrl);

        await _unitOfWork.Outbox.AddAsync(new OutboxMessage
        {
            TenantId = invitation.TenantId,
            Recipient = invitation.Email,
            Type = "invitation",
            Subject = $"Te han invitado a MyFitnessLife ({tenant.Name})",
            BodyHtml = html,
            Payload = invitation.Id.ToString(),
            Status = NotificationStatus.Pending
        });

        await _unitOfWork.SaveChangesAsync();
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var address = new MailAddress(email);
            return address.Address == email;
        }
        catch
        {
            return false;
        }
    }

    private static string RoleLabel(UserRole role) => role switch
    {
        UserRole.Admin => "Administrador",
        UserRole.Nutritionist => "Nutricionista",
        UserRole.Trainer => "Entrenador",
        UserRole.Patient => "Paciente",
        _ => role.ToString()
    };

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
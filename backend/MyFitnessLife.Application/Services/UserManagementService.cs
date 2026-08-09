using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Application.DTOs.Users;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Application.Mapping;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class UserManagementService : IUserManagementService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITenantActivityService _activityService;

    public UserManagementService(
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        ITenantActivityService activityService)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _activityService = activityService;
    }

    public async Task<InviteUserResponse> InviteUserAsync(Guid inviterId, Guid tenantId, InviteUserRequest request)
    {
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId);
        if (tenant is null)
            throw new KeyNotFoundException("Tenant no encontrado.");

        var email = request.Email.Trim().ToLowerInvariant();
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
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            Status = InvitationStatus.Pending
        };

        await _unitOfWork.Invitations.AddAsync(invitation);
        await _activityService.RecordEntityAsync(tenantId, "invite", "User", invitation.Id.ToString(), email);
        await _unitOfWork.SaveChangesAsync();

        return new InviteUserResponse
        {
            Id = invitation.Id,
            Email = email,
            Role = request.Role.ToString(),
            Status = invitation.Status.ToString(),
            Token = invitation.Token,
            ExpiresAt = invitation.ExpiresAt
        };
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
}
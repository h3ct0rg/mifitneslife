using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

/// <summary>Utilidades compartidas de membresías (multi-rol).</summary>
internal static class MembershipHelper
{
    public static MembershipDto ToDto(UserMembership m)
        => new()
        {
            Id = m.Id,
            TenantId = m.TenantId,
            TenantName = m.TenantId.HasValue ? m.Tenant?.Name : null,
            Role = m.Role.ToString(),
            Status = m.Status.ToString(),
            LastUsedAt = m.LastUsedAt
        };

    public static bool IsUsable(UserMembership m)
        => m.Status == UserStatus.Active && (m.TenantId is null || m.Tenant is { IsActive: true });

    /// <summary>D3: Role/TenantId del usuario reflejan la membresía por defecto (última usada).</summary>
    public static void ApplyMirror(ApplicationUser user, UserMembership membership)
    {
        user.Role = membership.Role;
        user.TenantId = membership.TenantId;
        user.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Membresía por defecto entre las utilizables: la del espejo si sigue válida; si no, la última usada.</summary>
    public static UserMembership? ResolveDefault(ApplicationUser user, IReadOnlyList<UserMembership> usable)
        => usable.FirstOrDefault(m => m.Role == user.Role && m.TenantId == user.TenantId)
           ?? usable.FirstOrDefault();

    /// <summary>
    /// AC-3: AspNetUserRoles = conjunto de roles de las membresías persistidas del usuario.
    /// Llamar después de SaveChanges (lee BD) y volver a guardar.
    /// </summary>
    public static async Task SyncIdentityRolesAsync(IUnitOfWork unitOfWork, Guid userId)
    {
        var roles = (await unitOfWork.Memberships.GetByUserAsync(userId))
            .Select(m => m.Role)
            .Distinct()
            .ToList();
        await unitOfWork.Users.SyncIdentityRolesAsync(userId, roles);
    }

    /// <summary>
    /// UserDto con la membresía actual y la lista de membresías utilizables. Con currentMembershipId
    /// (claim membership_id) esa membresía debe seguir siendo válida → si no, 401 para que el cliente
    /// refresque o vuelva al login. Sin él (tokens antiguos) se usa la membresía por defecto.
    /// </summary>
    public static async Task<UserDto> BuildUserDtoAsync(IUnitOfWork unitOfWork, ApplicationUser user, Guid? currentMembershipId)
    {
        var usable = await unitOfWork.Memberships.GetByUserAsync(user.Id, usableOnly: true);
        var current = currentMembershipId.HasValue
            ? usable.FirstOrDefault(m => m.Id == currentMembershipId.Value)
                ?? throw new UnauthorizedAccessException("El perfil de la sesión ya no está disponible.")
            : ResolveDefault(user, usable);

        // AC-8: suscripción del tenant actual (null sin tenant, p. ej. SuperAdmin). Se lee de BD, sin caché.
        UserSubscriptionDto? subscription = null;
        if (current?.TenantId is { } tenantId)
        {
            var now = DateTime.UtcNow;
            subscription = SubscriptionHelper.ToUserDto(await unitOfWork.TenantSubscriptions.GetCurrentAsync(tenantId, now), now);
        }

        return new UserDto(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email!,
            current?.TenantId,
            (current?.Role ?? user.Role).ToString(),
            user.Status.ToString(),
            user.FullName,
            current?.Id,
            usable.Select(ToDto).ToList())
        {
            Subscription = subscription
        };
    }
}

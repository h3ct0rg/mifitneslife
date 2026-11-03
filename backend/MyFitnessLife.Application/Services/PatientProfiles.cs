using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

/// <summary>
/// Garantiza la ficha clínica (Patient) de un usuario con rol Patient en su tenant.
/// Compartido por el registro/login (AuthService) y la asignación de roles del SuperAdmin.
/// </summary>
internal static class PatientProfiles
{
    public static async Task EnsureAsync(IUnitOfWork unitOfWork, Guid tenantId, string email, string firstName, string lastName)
    {
        var existing = await unitOfWork.Patients.GetByEmailAsync(tenantId, email);
        if (existing is not null)
            return;

        await unitOfWork.Patients.AddAsync(new Patient
        {
            TenantId = tenantId,
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            Status = UserStatus.Active
        });
    }
}

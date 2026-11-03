using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.Application.DTOs.Patients;

public class CreatePatientRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? ProfilePhotoUrl { get; set; }
    public string? Notes { get; set; }
}

public class UpdatePatientRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? ProfilePhotoUrl { get; set; }
    public string? Notes { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
}

public class PatientDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? ProfilePhotoUrl { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    /// <summary>Existe un usuario (ApplicationUser) con este email en el tenant.</summary>
    public bool HasAccount { get; set; }
    /// <summary>Existe una invitación Pending para este email en el tenant.</summary>
    public bool PendingInvitation { get; set; }
}

public static class PatientInvitationStatus
{
    public const string Sent = "sent";
    public const string Resent = "resent";
    /// <summary>Multi-rol: el usuario ya tiene la membresía Patient en este tenant.</summary>
    public const string AlreadyMember = "already_member";
    /// <summary>N2: no se pudo generar la invitación (el paciente sí se creó).</summary>
    public const string Failed = "failed";
    /// <summary>Sin email válido.</summary>
    public const string None = "none";
}

/// <summary>Respuesta de POST api/patients: PatientDto + resultado de la invitación.</summary>
public class PatientCreatedDto : PatientDto
{
    public string InvitationStatus { get; set; } = PatientInvitationStatus.None;
}

public class PatientInviteResultDto
{
    public string InvitationStatus { get; set; } = PatientInvitationStatus.None;
}

public class PagedResult<T>
{
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int Total { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(Total / (double)PageSize) : 0;
    public IEnumerable<T> Items { get; set; } = [];
}
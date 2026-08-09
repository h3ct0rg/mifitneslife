namespace MyFitnessLife.Application.DTOs.Appointments;

public class CreateAppointmentRequest
{
    public Guid PatientId { get; set; }
    public Guid ProfessionalId { get; set; }
    public Guid? DietId { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public string? Title { get; set; }
    public string? Notes { get; set; }
}

public class UpdateAppointmentRequest
{
    public Guid PatientId { get; set; }
    public Guid ProfessionalId { get; set; }
    public Guid? DietId { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public string? Title { get; set; }
    public string? Notes { get; set; }
    public string? Status { get; set; }
}

public class AppointmentDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientFullName { get; set; } = string.Empty;
    public Guid ProfessionalId { get; set; }
    public string ProfessionalFullName { get; set; } = string.Empty;
    public string ProfessionalRole { get; set; } = string.Empty;
    public Guid? DietId { get; set; }
    public string? DietName { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Notes { get; set; }
}

public class ProfessionalDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}
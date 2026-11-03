namespace MyFitnessLife.Application.DTOs.Dashboard;

public class DashboardKpisDto
{
    /// <summary>"tenant" (Admin) | "professional" (Nutritionist/Trainer).</summary>
    public string Scope { get; set; } = "tenant";
    public DateTime GeneratedAt { get; set; }
    public PatientKpisDto Patients { get; set; } = new();
    public AppointmentKpisDto Appointments { get; set; } = new();
    public IEnumerable<MonthlyKpiDto> Monthly { get; set; } = [];
    public IEnumerable<ProfessionalKpiDto> Professionals { get; set; } = [];
    public IEnumerable<AtRiskPatientDto> AtRiskPatients { get; set; } = [];
    public IEnumerable<TodayAppointmentDto> TodayAppointments { get; set; } = [];
}

public class PatientKpisDto
{
    public int Total { get; set; }
    public int Active { get; set; }
    public int NewThisMonth { get; set; }
    public int NewPrevMonth { get; set; }
    public int WithDiet { get; set; }
    public int WithWorkout { get; set; }
    public int WithoutFollowUp30d { get; set; }
}

public class AppointmentStatusCountsDto
{
    public int Scheduled { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int NoShow { get; set; }
}

public class AppointmentKpisDto
{
    public int Today { get; set; }
    public int Next7Days { get; set; }
    public AppointmentStatusCountsDto ThisMonth { get; set; } = new();
    public AppointmentStatusCountsDto PrevMonth { get; set; } = new();
    public double? AttendanceRate { get; set; }
    public double? CancellationRate { get; set; }
    public double? NoShowRate { get; set; }
}

public class MonthlyKpiDto
{
    public string Month { get; set; } = string.Empty;
    public int NewPatients { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int NoShow { get; set; }
    public int Measurements { get; set; }
}

public class ProfessionalKpiDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int CompletedThisMonth { get; set; }
    public int Upcoming { get; set; }
    public int PatientsAttendedThisMonth { get; set; }
    public double? NoShowRate { get; set; }
}

public class AtRiskPatientDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public DateTime? LastActivityAt { get; set; }
    public int? DaysSinceActivity { get; set; }
}

public class TodayAppointmentDto
{
    public Guid Id { get; set; }
    public DateTime StartAt { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string ProfessionalName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

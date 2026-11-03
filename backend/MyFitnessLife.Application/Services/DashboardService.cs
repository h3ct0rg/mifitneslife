using System.Globalization;
using MyFitnessLife.Application.DTOs.Dashboard;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class DashboardService : IDashboardService
{
    private const int MonthsInSeries = 6;
    private const int FollowUpDays = 30;
    private const int MaxListItems = 10;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IClientClock _clock;

    public DashboardService(IUnitOfWork unitOfWork, IClientClock clock)
    {
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    public async Task<DashboardKpisDto> GetKpisAsync(Guid tenantId, Guid userId, UserRole role)
    {
        if (role is not (UserRole.Admin or UserRole.Nutritionist or UserRole.Trainer))
            throw new UnauthorizedAccessException("Acceso denegado.");

        // D2: Admin ve todo el tenant; Nutritionist/Trainer solo sus citas.
        var isAdmin = role == UserRole.Admin;
        Guid? professionalId = isAdmin ? null : userId;

        // Zona horaria (D3/D4 de la tarea zona-horaria): "hoy", "ahora" y meses en la zona del
        // cliente (X-Time-Zone; sin header = UTC). Variables locales = hora de reloj (comparan
        // Appointment.StartAt y Measurement.VisitDate); *Utc = límites locales convertidos a UTC
        // (comparan CreatedAt).
        var now = _clock.LocalNow;
        var today = _clock.LocalToday;
        var tomorrow = today.AddDays(1);
        var thisMonthStart = new DateTime(today.Year, today.Month, 1);
        var nextMonthStart = thisMonthStart.AddMonths(1);
        var prevMonthStart = thisMonthStart.AddMonths(-1);
        var seriesStart = thisMonthStart.AddMonths(-(MonthsInSeries - 1));
        var followUpCutoff = now.AddDays(-FollowUpDays);
        var seriesMonths = Enumerable.Range(0, MonthsInSeries).Select(i => seriesStart.AddMonths(i)).ToList();

        var repo = _unitOfWork.Dashboard;

        // Pacientes: siempre a nivel tenant (D2).
        var patients = await repo.GetPatientKpisAsync(tenantId,
            _clock.ToUtc(prevMonthStart), _clock.ToUtc(thisMonthStart), _clock.ToUtc(nextMonthStart),
            followUpCutoff, now);

        // Citas: filtradas por profesional si aplica.
        var byMonthStatus = await repo.GetAppointmentsByMonthAndStatusAsync(tenantId, professionalId, seriesStart, nextMonthStart);
        var todayCount = await repo.CountAppointmentsAsync(tenantId, professionalId, today, tomorrow,
            [AppointmentStatus.Scheduled, AppointmentStatus.Completed, AppointmentStatus.NoShow]);
        var next7Days = await repo.CountAppointmentsAsync(tenantId, professionalId, now, now.AddDays(7),
            [AppointmentStatus.Scheduled]);

        var newPatientsByMonth = await repo.GetNewPatientsByRangesAsync(tenantId,
            seriesMonths.Select(m => (_clock.ToUtc(m), _clock.ToUtc(m.AddMonths(1)))).ToList());
        var measurementsByMonth = await repo.GetMeasurementsByMonthAsync(tenantId, seriesStart, nextMonthStart);

        var professionals = isAdmin
            ? await repo.GetProfessionalKpisAsync(tenantId, thisMonthStart, nextMonthStart, now)
            : [];

        var atRisk = await repo.GetAtRiskPatientsAsync(tenantId, followUpCutoff, now, MaxListItems);
        var todayAppointments = await repo.GetAppointmentsInRangeAsync(tenantId, professionalId, today, tomorrow, MaxListItems);

        var thisMonth = CountsFor(byMonthStatus, thisMonthStart);
        var prevMonth = CountsFor(byMonthStatus, prevMonthStart);
        var thisMonthTotal = thisMonth.Scheduled + thisMonth.Completed + thisMonth.Cancelled + thisMonth.NoShow;

        var monthly = seriesMonths
            .Select((m, i) =>
            {
                var counts = CountsFor(byMonthStatus, m);
                return new MonthlyKpiDto
                {
                    Month = m.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                    NewPatients = newPatientsByMonth[i],
                    Completed = counts.Completed,
                    Cancelled = counts.Cancelled,
                    NoShow = counts.NoShow,
                    Measurements = measurementsByMonth.GetValueOrDefault((m.Year, m.Month))
                };
            })
            .ToList();

        return new DashboardKpisDto
        {
            Scope = isAdmin ? "tenant" : "professional",
            GeneratedAt = _clock.UtcNow, // instante real (UTC, con Z); el contrato no cambia.
            Patients = new PatientKpisDto
            {
                Total = patients.Total,
                Active = patients.Active,
                NewThisMonth = patients.NewThisMonth,
                NewPrevMonth = patients.NewPrevMonth,
                WithDiet = patients.WithDiet,
                WithWorkout = patients.WithWorkout,
                WithoutFollowUp30d = patients.WithoutFollowUp
            },
            Appointments = new AppointmentKpisDto
            {
                Today = todayCount,
                Next7Days = next7Days,
                ThisMonth = thisMonth,
                PrevMonth = prevMonth,
                AttendanceRate = Rate(thisMonth.Completed, thisMonth.Completed + thisMonth.NoShow),
                CancellationRate = Rate(thisMonth.Cancelled, thisMonthTotal),
                NoShowRate = Rate(thisMonth.NoShow, thisMonth.Completed + thisMonth.NoShow)
            },
            Monthly = monthly,
            Professionals = professionals
                .Select(p => new ProfessionalKpiDto
                {
                    Id = p.Id,
                    FullName = p.FullName,
                    Role = p.Role.ToString(),
                    CompletedThisMonth = p.CompletedThisMonth,
                    Upcoming = p.Upcoming,
                    PatientsAttendedThisMonth = p.PatientsAttendedThisMonth,
                    NoShowRate = Rate(p.NoShowThisMonth, p.CompletedThisMonth + p.NoShowThisMonth)
                })
                .OrderByDescending(p => p.CompletedThisMonth)
                .ThenBy(p => p.FullName)
                .ToList(),
            AtRiskPatients = atRisk
                .Select(p => new AtRiskPatientDto
                {
                    Id = p.Id,
                    FullName = p.FullName.Trim(),
                    LastActivityAt = p.LastActivityAt,
                    DaysSinceActivity = p.LastActivityAt.HasValue
                        ? (int)Math.Floor((now - p.LastActivityAt.Value).TotalDays)
                        : null
                })
                .ToList(),
            TodayAppointments = todayAppointments
                .Select(a => new TodayAppointmentDto
                {
                    Id = a.Id,
                    StartAt = a.StartAt,
                    PatientId = a.PatientId,
                    PatientName = a.PatientName.Trim(),
                    ProfessionalName = a.ProfessionalName.Trim(),
                    Status = a.Status.ToString()
                })
                .ToList()
        };
    }

    private static AppointmentStatusCountsDto CountsFor(IEnumerable<MonthStatusCount> rows, DateTime month)
    {
        var dto = new AppointmentStatusCountsDto();
        foreach (var r in rows.Where(r => r.Year == month.Year && r.Month == month.Month))
        {
            switch (r.Status)
            {
                case AppointmentStatus.Scheduled: dto.Scheduled += r.Count; break;
                case AppointmentStatus.Completed: dto.Completed += r.Count; break;
                case AppointmentStatus.Cancelled: dto.Cancelled += r.Count; break;
                case AppointmentStatus.NoShow: dto.NoShow += r.Count; break;
            }
        }
        return dto;
    }

    /// <summary>AC-3: null si el denominador es 0.</summary>
    private static double? Rate(int numerator, int denominator)
        => denominator == 0 ? null : Math.Round((double)numerator / denominator, 4);
}

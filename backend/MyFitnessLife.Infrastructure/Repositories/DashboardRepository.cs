using Microsoft.EntityFrameworkCore;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;
using MyFitnessLife.Infrastructure.Data;

namespace MyFitnessLife.Infrastructure.Repositories;

/// <summary>
/// KPIs de gestión del tenant. Todas las consultas son agregadas/proyectadas en BD
/// (Count/GroupBy/subconsultas), filtradas por TenantId y sin tracking.
/// </summary>
public class DashboardRepository : IDashboardRepository
{
    private readonly AppDbContext _context;

    public DashboardRepository(AppDbContext context) => _context = context;

    private IQueryable<Domain.Entities.Appointment> Appointments(Guid tenantId, Guid? professionalId)
    {
        var query = _context.Appointments.AsNoTracking().Where(a => a.TenantId == tenantId);
        if (professionalId.HasValue)
            query = query.Where(a => a.ProfessionalId == professionalId.Value);
        return query;
    }

    /// <summary>
    /// Pacientes activos con su última actividad (D4): máx. entre la última cita Completed
    /// y la última Measurement.VisitDate, ambas no futuras. Se evalúa en BD como subconsultas.
    /// </summary>
    private IQueryable<PatientActivity> ActivePatientsWithActivity(Guid tenantId, DateTime now)
        => _context.Patients.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.Status == UserStatus.Active)
            .Select(p => new
            {
                p.Id,
                p.FirstName,
                p.LastName,
                LastAppointment = _context.Appointments
                    .Where(a => a.TenantId == tenantId && a.PatientId == p.Id
                        && a.Status == AppointmentStatus.Completed && a.StartAt <= now)
                    .Max(a => (DateTime?)a.StartAt),
                LastMeasurement = _context.Measurements
                    .Where(m => m.TenantId == tenantId && m.PatientId == p.Id && m.VisitDate <= now)
                    .Max(m => (DateTime?)m.VisitDate)
            })
            .Select(x => new PatientActivity
            {
                Id = x.Id,
                FirstName = x.FirstName,
                LastName = x.LastName,
                LastActivityAt = x.LastAppointment == null
                    ? x.LastMeasurement
                    : (x.LastMeasurement == null || x.LastAppointment > x.LastMeasurement
                        ? x.LastAppointment
                        : x.LastMeasurement)
            });

    private sealed class PatientActivity
    {
        public Guid Id { get; init; }
        public string FirstName { get; init; } = string.Empty;
        public string LastName { get; init; } = string.Empty;
        public DateTime? LastActivityAt { get; init; }
    }

    public async Task<PatientKpis> GetPatientKpisAsync(
        Guid tenantId, DateTime prevMonthStartUtc, DateTime thisMonthStartUtc, DateTime nextMonthStartUtc, DateTime followUpCutoff, DateTime now)
    {
        var patients = _context.Patients.AsNoTracking().Where(p => p.TenantId == tenantId);
        var active = patients.Where(p => p.Status == UserStatus.Active);

        var total = await patients.CountAsync();
        var activeCount = await active.CountAsync();
        // CreatedAt es UTC → límites del mes local convertidos a UTC.
        var newThisMonth = await patients.CountAsync(p => p.CreatedAt >= thisMonthStartUtc && p.CreatedAt < nextMonthStartUtc);
        var newPrevMonth = await patients.CountAsync(p => p.CreatedAt >= prevMonthStartUtc && p.CreatedAt < thisMonthStartUtc);
        var withDiet = await active.CountAsync(p =>
            _context.Diets.Any(d => d.TenantId == tenantId && d.PatientId == p.Id));
        var withWorkout = await active.CountAsync(p =>
            _context.WorkoutPlans.Any(w => w.TenantId == tenantId && w.PatientId == p.Id));
        var withoutFollowUp = await ActivePatientsWithActivity(tenantId, now)
            .CountAsync(x => x.LastActivityAt == null || x.LastActivityAt < followUpCutoff);

        return new PatientKpis(total, activeCount, newThisMonth, newPrevMonth, withDiet, withWorkout, withoutFollowUp);
    }

    public async Task<IReadOnlyList<MonthStatusCount>> GetAppointmentsByMonthAndStatusAsync(
        Guid tenantId, Guid? professionalId, DateTime from, DateTime to)
        => await Appointments(tenantId, professionalId)
            .Where(a => a.StartAt >= from && a.StartAt < to)
            .GroupBy(a => new { a.StartAt.Year, a.StartAt.Month, a.Status })
            .Select(g => new MonthStatusCount(g.Key.Year, g.Key.Month, g.Key.Status, g.Count()))
            .ToListAsync();

    public Task<int> CountAppointmentsAsync(
        Guid tenantId, Guid? professionalId, DateTime from, DateTime to, IReadOnlyCollection<AppointmentStatus> statuses)
    {
        var list = statuses.ToList();
        return Appointments(tenantId, professionalId)
            .CountAsync(a => a.StartAt >= from && a.StartAt < to && list.Contains(a.Status));
    }

    public async Task<IReadOnlyList<int>> GetNewPatientsByRangesAsync(Guid tenantId, IReadOnlyList<(DateTime FromUtc, DateTime ToUtc)> ranges)
    {
        // Agrupar por Year/Month de CreatedAt (UTC) desplazaría los bordes de mes locales;
        // se cuenta cada mes local (convertido a UTC) con un Count agregado en BD.
        var result = new List<int>(ranges.Count);
        foreach (var (fromUtc, toUtc) in ranges)
            result.Add(await _context.Patients.AsNoTracking()
                .CountAsync(p => p.TenantId == tenantId && p.CreatedAt >= fromUtc && p.CreatedAt < toUtc));
        return result;
    }

    public async Task<Dictionary<(int Year, int Month), int>> GetMeasurementsByMonthAsync(Guid tenantId, DateTime from, DateTime to)
    {
        var rows = await _context.Measurements.AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.VisitDate >= from && m.VisitDate < to)
            .GroupBy(m => new { m.VisitDate.Year, m.VisitDate.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync();
        return rows.ToDictionary(r => (r.Year, r.Month), r => r.Count);
    }

    public async Task<IReadOnlyList<ProfessionalKpiRow>> GetProfessionalKpisAsync(
        Guid tenantId, DateTime monthStart, DateTime monthEnd, DateTime now)
    {
        // Mismo criterio que AppointmentService.GetProfessionalsAsync (multi-rol: membresías staff
        // activas del tenant; varias por usuario → la de mayor rango).
        var staff = await _context.UserMemberships.AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.Status == UserStatus.Active
                && (m.Role == UserRole.Admin || m.Role == UserRole.Nutritionist || m.Role == UserRole.Trainer))
            .GroupBy(m => new { m.UserId, m.User!.FirstName, m.User.LastName })
            .Select(g => new { Id = g.Key.UserId, g.Key.FirstName, g.Key.LastName, Role = g.Min(m => m.Role) })
            .ToListAsync();

        var tenantAppointments = Appointments(tenantId, null);

        var monthStats = await tenantAppointments
            .Where(a => a.StartAt >= monthStart && a.StartAt < monthEnd)
            .GroupBy(a => a.ProfessionalId)
            .Select(g => new
            {
                ProfessionalId = g.Key,
                Completed = g.Count(a => a.Status == AppointmentStatus.Completed),
                NoShow = g.Count(a => a.Status == AppointmentStatus.NoShow)
            })
            .ToDictionaryAsync(x => x.ProfessionalId);

        var attended = await tenantAppointments
            .Where(a => a.StartAt >= monthStart && a.StartAt < monthEnd && a.Status == AppointmentStatus.Completed)
            .GroupBy(a => a.ProfessionalId)
            .Select(g => new { ProfessionalId = g.Key, Patients = g.Select(a => a.PatientId).Distinct().Count() })
            .ToDictionaryAsync(x => x.ProfessionalId, x => x.Patients);

        var upcoming = await tenantAppointments
            .Where(a => a.StartAt >= now && a.Status == AppointmentStatus.Scheduled)
            .GroupBy(a => a.ProfessionalId)
            .Select(g => new { ProfessionalId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ProfessionalId, x => x.Count);

        return staff
            .Select(u =>
            {
                monthStats.TryGetValue(u.Id, out var stats);
                return new ProfessionalKpiRow(
                    u.Id,
                    $"{u.FirstName} {u.LastName}".Trim(),
                    u.Role,
                    stats?.Completed ?? 0,
                    stats?.NoShow ?? 0,
                    upcoming.GetValueOrDefault(u.Id),
                    attended.GetValueOrDefault(u.Id));
            })
            .ToList();
    }

    public async Task<IReadOnlyList<AtRiskPatientRow>> GetAtRiskPatientsAsync(Guid tenantId, DateTime followUpCutoff, DateTime now, int take)
        => await ActivePatientsWithActivity(tenantId, now)
            .Where(x => x.LastActivityAt == null || x.LastActivityAt < followUpCutoff)
            .OrderBy(x => x.LastActivityAt == null ? 0 : 1)
            .ThenBy(x => x.LastActivityAt)
            .ThenBy(x => x.FirstName)
            .Take(take)
            .Select(x => new AtRiskPatientRow(x.Id, x.FirstName + " " + x.LastName, x.LastActivityAt))
            .ToListAsync();

    public async Task<IReadOnlyList<TodayAppointmentRow>> GetAppointmentsInRangeAsync(
        Guid tenantId, Guid? professionalId, DateTime from, DateTime to, int take)
        => await Appointments(tenantId, professionalId)
            .Where(a => a.StartAt >= from && a.StartAt < to)
            .OrderBy(a => a.StartAt)
            .Take(take)
            .Select(a => new TodayAppointmentRow(
                a.Id,
                a.StartAt,
                a.PatientId,
                a.Patient != null ? a.Patient.FirstName + " " + a.Patient.LastName : string.Empty,
                a.Professional != null ? a.Professional.FirstName + " " + a.Professional.LastName : string.Empty,
                a.Status))
            .ToListAsync();
}

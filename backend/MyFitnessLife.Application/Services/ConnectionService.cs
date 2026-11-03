using System.Globalization;
using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

/// <summary>
/// Conexiones (LoginEvent) para el SuperAdmin. Rango [from, to) en UTC; sin rango → últimos 7 días.
/// La serie diaria se agrupa por día LOCAL del cliente (IClientClock / header X-Time-Zone).
/// </summary>
public class ConnectionService : IConnectionService
{
    private const int MaxPageSize = 100;
    private const int DefaultRangeDays = 7;
    private const int MaxRangeDays = 366;

    private static readonly UserRole[] DoctorRoles = [UserRole.Nutritionist, UserRole.Trainer];

    private readonly IUnitOfWork _unitOfWork;
    private readonly IClientClock _clock;

    public ConnectionService(IUnitOfWork unitOfWork, IClientClock clock)
    {
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    public async Task<ConnectionsSummaryDto> GetSummaryAsync(DateTime? fromUtc, DateTime? toUtc, Guid? tenantId, string? role)
    {
        var filter = BuildFilter(fromUtc, toUtc, tenantId, role);
        // Agregación en memoria sobre una proyección mínima (UserId, Role, OccurredAt): el rango
        // está acotado a 366 días y así la serie diaria usa la zona horaria del cliente.
        var points = await _unitOfWork.LoginEvents.GetPointsAsync(filter);

        int Unique(Func<UserRole, bool> predicate)
            => points.Where(p => predicate(p.Role)).Select(p => p.UserId).Distinct().Count();

        var byDay = points
            .GroupBy(p => LocalDate(p.OccurredAt))
            .ToDictionary(g => g.Key, g => (Unique: g.Select(p => p.UserId).Distinct().Count(), Logins: g.Count()));

        // Días locales del rango, rellenando con 0 (to es exclusivo).
        var daily = new List<DailyConnectionsDto>();
        var firstDay = LocalDate(filter.FromUtc);
        var lastDay = LocalDate(filter.ToUtc.AddTicks(-1));
        for (var day = firstDay; day <= lastDay; day = day.AddDays(1))
        {
            var stats = byDay.GetValueOrDefault(day);
            daily.Add(new DailyConnectionsDto
            {
                Date = day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                UniqueUsers = stats.Unique,
                Logins = stats.Logins
            });
        }

        return new ConnectionsSummaryDto
        {
            TotalLogins = points.Count,
            UniqueUsers = points.Select(p => p.UserId).Distinct().Count(),
            UniqueByRole = new UniqueByRoleDto
            {
                Admin = Unique(r => r == UserRole.Admin),
                Doctor = Unique(r => DoctorRoles.Contains(r)),
                Patient = Unique(r => r == UserRole.Patient)
            },
            Daily = daily
        };
    }

    public async Task<PagedResult<ConnectionDto>> GetConnectionsAsync(
        DateTime? fromUtc, DateTime? toUtc, Guid? tenantId, string? role, string? search, int page, int pageSize)
    {
        var filter = BuildFilter(fromUtc, toUtc, tenantId, role);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var (items, total) = await _unitOfWork.LoginEvents.SearchAsync(filter, search, page, pageSize);
        return new PagedResult<ConnectionDto>
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = items.Select(r => new ConnectionDto
            {
                Id = r.Id,
                OccurredAt = r.OccurredAt,
                UserId = r.UserId,
                UserName = r.UserName,
                Email = r.Email,
                TenantId = r.TenantId,
                TenantName = r.TenantName,
                Role = r.Role.ToString(),
                Method = r.Method.ToString()
            }).ToList()
        };
    }

    private LoginEventFilter BuildFilter(DateTime? fromUtc, DateTime? toUtc, Guid? tenantId, string? role)
    {
        var to = toUtc.HasValue ? AsUtc(toUtc.Value) : _clock.UtcNow;
        var from = fromUtc.HasValue ? AsUtc(fromUtc.Value) : to.AddDays(-DefaultRangeDays);
        if (from >= to)
            throw new InvalidOperationException("El rango de fechas no es válido: 'from' debe ser anterior a 'to'.");
        if ((to - from).TotalDays > MaxRangeDays)
            throw new InvalidOperationException($"El rango de fechas no puede superar {MaxRangeDays} días.");

        return new LoginEventFilter(from, to, tenantId is { } t && t != Guid.Empty ? t : null, ParseRoleGroup(role));
    }

    /// <summary>admin → Admin; doctor → Nutritionist + Trainer; patient → Patient; vacío → todos.</summary>
    private static IReadOnlyCollection<UserRole>? ParseRoleGroup(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
            return null;

        return role.Trim().ToLowerInvariant() switch
        {
            "admin" => [UserRole.Admin],
            "doctor" => DoctorRoles,
            "patient" => [UserRole.Patient],
            _ => throw new InvalidOperationException("Rol inválido. Valores permitidos: admin, doctor, patient.")
        };
    }

    private static DateTime AsUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };

    private DateOnly LocalDate(DateTime utc)
        => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), _clock.TimeZone));
}

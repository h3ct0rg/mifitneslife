using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Services;

/// <summary>
/// Implementación scoped de <see cref="IClientClock"/>: zona del header <c>X-Time-Zone</c> (IANA,
/// con fallback IANA→Windows) y hora de <see cref="TimeProvider"/> (sustituible en pruebas).
/// </summary>
public sealed class ClientClock : IClientClock
{
    public const string HeaderName = "X-Time-Zone";

    private static readonly System.Text.RegularExpressions.Regex AllowedId =
        new(@"^[A-Za-z0-9_+\-/]{1,64}$", System.Text.RegularExpressions.RegexOptions.Compiled | System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    private readonly TimeProvider _timeProvider;

    public ClientClock(IHttpContextAccessor httpContextAccessor, TimeProvider timeProvider, ILogger<ClientClock> logger)
    {
        _timeProvider = timeProvider;
        var raw = httpContextAccessor.HttpContext?.Request.Headers[HeaderName].ToString();
        TimeZone = Resolve(raw, logger);
    }

    public TimeZoneInfo TimeZone { get; }

    public DateTime UtcNow => _timeProvider.GetUtcNow().UtcDateTime;

    public DateTime LocalNow => DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(UtcNow, TimeZone), DateTimeKind.Unspecified);

    public DateTime LocalToday => LocalNow.Date;

    public DateTime ToUtc(DateTime localWallClock)
    {
        if (localWallClock.Kind == DateTimeKind.Utc)
            return localWallClock;

        var unspecified = DateTime.SpecifyKind(localWallClock, DateTimeKind.Unspecified);
        // Hora inexistente (salto DST): se adelanta una hora para no lanzar excepción.
        if (TimeZone.IsInvalidTime(unspecified))
            unspecified = unspecified.AddHours(1);
        return TimeZoneInfo.ConvertTimeToUtc(unspecified, TimeZone);
    }

    public DateTime ToWallClock(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(value, TimeZone), DateTimeKind.Unspecified),
        DateTimeKind.Local => DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(value.ToUniversalTime(), TimeZone), DateTimeKind.Unspecified),
        _ => value
    };

    /// <summary>IANA (ICU en .NET 10) → si falla, conversión IANA→Windows → si falla o falta, UTC (D3/D6).</summary>
    private static TimeZoneInfo Resolve(string? id, ILogger logger)
    {
        if (string.IsNullOrWhiteSpace(id))
            return TimeZoneInfo.Utc;

        id = id.Trim();
        // N1: lista blanca de caracteres de un id IANA antes de consultar el sistema.
        if (!AllowedId.IsMatch(id))
        {
            logger.LogDebug("Header {Header} con formato no permitido; se usa UTC.", HeaderName);
            return TimeZoneInfo.Utc;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch (Exception)
        {
            // Cualquier fallo (id desconocido, caracteres inválidos…) → nunca 500.
            if (TimeZoneInfo.TryConvertIanaIdToWindowsId(id, out var windowsId))
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById(windowsId);
                }
                catch (Exception)
                {
                }
            }

            logger.LogDebug("Header {Header} inválido ({Value}); se usa UTC.", HeaderName, id);
            return TimeZoneInfo.Utc;
        }
    }
}

/// <summary>Reloj fijo para pruebas locales (solo Development, config <c>Clock:FixedUtcNow</c>).</summary>
public sealed class FixedTimeProvider : TimeProvider
{
    private readonly DateTimeOffset _utcNow;

    public FixedTimeProvider(DateTimeOffset utcNow) => _utcNow = utcNow.ToUniversalTime();

    public override DateTimeOffset GetUtcNow() => _utcNow;
}

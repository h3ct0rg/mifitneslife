namespace MyFitnessLife.Application.Interfaces;

/// <summary>
/// Reloj del cliente (zona horaria del header <c>X-Time-Zone</c>, IANA). Sin header o con uno
/// inválido → UTC (comportamiento previo).
///
/// Dos marcos de fecha en el modelo (D1/D4):
/// <list type="bullet">
/// <item><b>Hora de reloj (wall-clock)</b>, sin zona, Kind Unspecified: <c>Appointment.StartAt/EndAt</c>,
/// <c>Measurement.VisitDate</c>, <c>PatientPhoto.TakenAt</c>, <c>Diet.StartDate/EndDate</c>. Lo que el
/// usuario eligió en la clínica; se comparan contra <see cref="LocalNow"/>/<see cref="LocalToday"/>.</item>
/// <item><b>UTC</b>: <c>CreatedAt</c>, <c>UpdatedAt</c>, <c>LastLoginAt</c>, <c>AuditLog.Timestamp</c>,
/// <c>PatientDiet.AssignedAt</c>, expiraciones… Se comparan contra límites locales convertidos con
/// <see cref="ToUtc"/>.</item>
/// </list>
/// </summary>
public interface IClientClock
{
    TimeZoneInfo TimeZone { get; }
    /// <summary>Instante actual en UTC (Kind Utc).</summary>
    DateTime UtcNow { get; }
    /// <summary>Hora de reloj actual en la zona del cliente (Kind Unspecified).</summary>
    DateTime LocalNow { get; }
    /// <summary>Medianoche de la fecha local actual (Kind Unspecified).</summary>
    DateTime LocalToday { get; }
    /// <summary>Hora de reloj local (zona del cliente) → instante UTC (Kind Utc).</summary>
    DateTime ToUtc(DateTime localWallClock);
    /// <summary>
    /// Normaliza un valor recibido a hora de reloj local: Kind Utc/Local se convierte a la zona del
    /// cliente; Unspecified se devuelve tal cual (ya es hora de reloj).
    /// </summary>
    DateTime ToWallClock(DateTime value);
}

using System.Collections.Concurrent;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

/// <summary>
/// Caché en memoria (singleton) del vencimiento de la suscripción vigente por tenant, para no
/// consultar la BD en cada petición. Se guarda EndsAt (no el estado), así el vencimiento se
/// aplica en el instante exacto; la entrada se refresca cada <see cref="Ttl"/> y se invalida al
/// asignar una suscripción desde esta instancia.
/// </summary>
public sealed class SubscriptionCache
{
    public static readonly TimeSpan Ttl = TimeSpan.FromSeconds(60);

    private readonly ConcurrentDictionary<Guid, (DateTime? EndsAt, DateTime LoadedAt)> _entries = new();

    public bool TryGet(Guid tenantId, DateTime now, out DateTime? endsAt)
    {
        if (_entries.TryGetValue(tenantId, out var entry) && now - entry.LoadedAt < Ttl)
        {
            endsAt = entry.EndsAt;
            return true;
        }
        endsAt = null;
        return false;
    }

    public void Set(Guid tenantId, DateTime? endsAt, DateTime now) => _entries[tenantId] = (endsAt, now);

    public void Invalidate(Guid tenantId) => _entries.TryRemove(tenantId, out _);
}

public class SubscriptionGate : ISubscriptionGate
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly SubscriptionCache _cache;

    public SubscriptionGate(IUnitOfWork unitOfWork, SubscriptionCache cache)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
    }

    public async Task<bool> IsTenantActiveAsync(Guid tenantId)
    {
        var now = DateTime.UtcNow;
        if (!_cache.TryGet(tenantId, now, out var endsAt))
        {
            endsAt = (await _unitOfWork.TenantSubscriptions.GetCurrentAsync(tenantId, now))?.EndsAt;
            _cache.Set(tenantId, endsAt, now);
        }
        return endsAt.HasValue && endsAt.Value > now;
    }
}

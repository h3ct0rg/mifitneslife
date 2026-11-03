using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

/// <summary>Valores de estado de suscripción expuestos en la API.</summary>
public static class SubscriptionStatuses
{
    public const string Active = "Active";
    public const string ExpiringSoon = "ExpiringSoon";
    public const string Expired = "Expired";
    public const string None = "None";
}

/// <summary>Reglas compartidas de suscripción (estado, resúmenes y alta del trial).</summary>
internal static class SubscriptionHelper
{
    /// <summary>U1: aviso desde 7 días antes del vencimiento.</summary>
    public const int ExpiringSoonDays = 7;

    /// <summary>Vigente ⇔ existe y no venció (EndsAt &gt; now).</summary>
    public static bool IsValid(TenantSubscription? subscription, DateTime now)
        => subscription is not null && subscription.EndsAt > now;

    public static (string Status, int DaysLeft) Evaluate(TenantSubscription? subscription, DateTime now)
    {
        if (subscription is null)
            return (SubscriptionStatuses.None, 0);
        if (subscription.EndsAt <= now)
            return (SubscriptionStatuses.Expired, 0);

        var remaining = subscription.EndsAt - now;
        var daysLeft = (int)Math.Ceiling(remaining.TotalDays);
        return (remaining.TotalDays <= ExpiringSoonDays ? SubscriptionStatuses.ExpiringSoon : SubscriptionStatuses.Active, daysLeft);
    }

    public static SubscriptionSummaryDto ToSummary(TenantSubscription? subscription, DateTime now)
    {
        var (status, daysLeft) = Evaluate(subscription, now);
        return new SubscriptionSummaryDto
        {
            PlanId = subscription?.PlanId,
            PlanName = subscription?.PlanName,
            StartsAt = subscription?.StartsAt,
            EndsAt = subscription?.EndsAt,
            Status = status,
            DaysLeft = daysLeft
        };
    }

    public static UserSubscriptionDto ToUserDto(TenantSubscription? subscription, DateTime now)
    {
        var (status, daysLeft) = Evaluate(subscription, now);
        return new UserSubscriptionDto
        {
            PlanName = subscription?.PlanName,
            EndsAt = subscription?.EndsAt,
            Status = status,
            DaysLeft = daysLeft
        };
    }

    public static TenantSubscription Create(Guid tenantId, SubscriptionPlan plan, DateTime now, Guid? createdBy, string? note)
        => new()
        {
            TenantId = tenantId,
            PlanId = plan.Id,
            PlanName = plan.Name,
            PriceUsd = plan.PriceUsd,
            StartsAt = now,
            EndsAt = now.AddDays(plan.DurationDays),
            CreatedAt = now,
            CreatedBy = createdBy,
            Note = note
        };

    /// <summary>
    /// AC-3: suscripción al plan trial para un tenant nuevo (sin guardar). Si el plan trial no
    /// existiera (la migración lo siembra y no se puede desactivar) el tenant queda sin suscripción.
    /// </summary>
    public static async Task<TenantSubscription?> StartTrialAsync(IUnitOfWork unitOfWork, Guid tenantId)
    {
        var trial = await unitOfWork.SubscriptionPlans.GetTrialAsync();
        if (trial is null)
            return null;

        var subscription = Create(tenantId, trial, DateTime.UtcNow, createdBy: null, note: null);
        await unitOfWork.TenantSubscriptions.AddAsync(subscription);
        return subscription;
    }
}

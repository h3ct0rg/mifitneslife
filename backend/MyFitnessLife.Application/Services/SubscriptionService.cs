using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.Exceptions;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class SubscriptionService : ISubscriptionService
{
    private const int MaxNameLength = 100;
    private const int MaxDurationDays = 3650;
    private const decimal MaxPriceUsd = 100000m;
    private const int MaxSortOrder = 10000;
    private const int MaxNoteLength = 500;

    private readonly IUnitOfWork _unitOfWork;
    private readonly ITenantActivityService _activityService;
    private readonly SubscriptionCache _cache;

    public SubscriptionService(IUnitOfWork unitOfWork, ITenantActivityService activityService, SubscriptionCache cache)
    {
        _unitOfWork = unitOfWork;
        _activityService = activityService;
        _cache = cache;
    }

    // ───────────────────────────── Planes ─────────────────────────────

    public async Task<IReadOnlyList<PlanDto>> GetPlansAsync()
    {
        var plans = await _unitOfWork.SubscriptionPlans.GetAllAsync();
        var counts = await CountTenantsByPlanAsync();
        return plans.Select(p => ToDto(p, counts.GetValueOrDefault(p.Id))).ToList();
    }

    public async Task<PlanDto> CreatePlanAsync(SavePlanRequest request)
    {
        var name = await ValidateAsync(request, excludeId: null);

        var plan = new SubscriptionPlan
        {
            Name = name,
            DurationDays = request.DurationDays,
            PriceUsd = RoundPrice(request.PriceUsd),
            IsTrial = false,
            IsActive = request.IsActive,
            SortOrder = request.SortOrder
        };
        await _unitOfWork.SubscriptionPlans.AddAsync(plan);
        await _unitOfWork.SaveChangesAsync();

        return ToDto(plan, 0);
    }

    public async Task<PlanDto> UpdatePlanAsync(Guid id, SavePlanRequest request)
    {
        var plan = await _unitOfWork.SubscriptionPlans.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Plan no encontrado.");

        var name = await ValidateAsync(request, excludeId: plan.Id);
        if (plan.IsTrial && !request.IsActive)
            throw new InvalidOperationException("El plan de prueba no se puede desactivar.");

        // Las suscripciones ya asignadas conservan su snapshot (nombre, precio y fechas).
        plan.Name = name;
        plan.DurationDays = request.DurationDays;
        plan.PriceUsd = RoundPrice(request.PriceUsd);
        plan.IsActive = request.IsActive;
        plan.SortOrder = request.SortOrder;
        plan.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        var counts = await CountTenantsByPlanAsync();
        return ToDto(plan, counts.GetValueOrDefault(plan.Id));
    }

    // ───────────────────────────── Suscripciones ─────────────────────────────

    public async Task<IReadOnlyList<TenantSubscriptionDto>> GetTenantSubscriptionsAsync(Guid tenantId)
    {
        _ = await _unitOfWork.Tenants.GetByIdAsync(tenantId) ?? throw new KeyNotFoundException("Tenant no encontrado.");

        var history = await _unitOfWork.TenantSubscriptions.GetHistoryAsync(tenantId);
        var names = new Dictionary<Guid, string>();
        foreach (var creatorId in history.Where(s => s.CreatedBy.HasValue).Select(s => s.CreatedBy!.Value).Distinct())
        {
            var user = await _unitOfWork.Users.GetByIdAsync(creatorId);
            if (user is not null)
                names[creatorId] = string.IsNullOrWhiteSpace(user.FullName) ? user.Email ?? string.Empty : user.FullName;
        }

        return history.Select(s => new TenantSubscriptionDto
        {
            Id = s.Id,
            PlanId = s.PlanId,
            PlanName = s.PlanName,
            PriceUsd = s.PriceUsd,
            StartsAt = s.StartsAt,
            EndsAt = s.EndsAt,
            CreatedAt = s.CreatedAt,
            CreatedByName = s.CreatedBy.HasValue ? names.GetValueOrDefault(s.CreatedBy.Value) : null,
            Note = s.Note
        }).ToList();
    }

    public async Task<SubscriptionSummaryDto> AssignAsync(Guid actorId, Guid tenantId, AssignSubscriptionRequest request)
    {
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId)
            ?? throw new KeyNotFoundException("Tenant no encontrado.");

        var plan = await _unitOfWork.SubscriptionPlans.GetByIdAsync(request.PlanId)
            ?? throw new InvalidOperationException("El plan indicado no existe.");
        if (!plan.IsActive)
            throw new InvalidOperationException("El plan está inactivo y no se puede asignar.");

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note is { Length: > MaxNoteLength })
            throw new InvalidOperationException($"La nota no puede superar {MaxNoteLength} caracteres.");

        var now = DateTime.UtcNow;
        var subscription = SubscriptionHelper.Create(tenant.Id, plan, now, actorId, note);
        await _unitOfWork.TenantSubscriptions.AddAsync(subscription);
        await _activityService.RecordEntityAsync(tenant.Id, "assign_subscription", "TenantSubscription", subscription.Id.ToString(), plan.Name);
        await _unitOfWork.SaveChangesAsync();

        _cache.Invalidate(tenant.Id);
        return SubscriptionHelper.ToSummary(subscription, now);
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    private async Task<Dictionary<Guid, int>> CountTenantsByPlanAsync()
        => (await _unitOfWork.TenantSubscriptions.GetCurrentByTenantAsync(DateTime.UtcNow)).Values
            .GroupBy(s => s.PlanId)
            .ToDictionary(g => g.Key, g => g.Count());

    private async Task<string> ValidateAsync(SavePlanRequest request, Guid? excludeId)
    {
        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length == 0)
            throw new InvalidOperationException("El nombre del plan es obligatorio.");
        if (name.Length > MaxNameLength)
            throw new InvalidOperationException($"El nombre del plan no puede superar {MaxNameLength} caracteres.");
        if (request.DurationDays is < 1 or > MaxDurationDays)
            throw new InvalidOperationException($"La duración debe estar entre 1 y {MaxDurationDays} días.");
        if (request.PriceUsd < 0 || request.PriceUsd > MaxPriceUsd)
            throw new InvalidOperationException($"El precio debe estar entre 0 y {MaxPriceUsd:0} USD.");
        if (request.SortOrder is < 0 or > MaxSortOrder)
            throw new InvalidOperationException($"El orden debe estar entre 0 y {MaxSortOrder}.");
        if (await _unitOfWork.SubscriptionPlans.NameExistsAsync(name, excludeId))
            throw new ConflictException($"Ya existe un plan con el nombre '{name}'.");
        return name;
    }

    private static decimal RoundPrice(decimal price) => Math.Round(price, 2, MidpointRounding.AwayFromZero);

    private static PlanDto ToDto(SubscriptionPlan p, int tenantsCount)
        => new()
        {
            Id = p.Id,
            Name = p.Name,
            DurationDays = p.DurationDays,
            PriceUsd = p.PriceUsd,
            IsTrial = p.IsTrial,
            IsActive = p.IsActive,
            SortOrder = p.SortOrder,
            TenantsCount = tenantsCount
        };
}

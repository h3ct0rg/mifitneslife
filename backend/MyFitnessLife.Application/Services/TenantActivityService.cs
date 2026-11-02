using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class TenantActivityService : ITenantActivityService
{
    private readonly IUnitOfWork _unitOfWork;

    public TenantActivityService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task RecordLoginAsync(Guid? tenantId, string email)
    {
        if (tenantId is null)
            return;

        await _unitOfWork.AuditLogs.AddAsync(new AuditLog
        {
            TenantId = tenantId,
            Action = "login",
            Entity = "Auth",
            Details = email
        });
    }

    public Task RecordCreateTenantAsync(Guid tenantId, string name)
        => RecordEntityAsync(tenantId, "create_tenant", "Tenant", tenantId.ToString(), name);

    public async Task RecordEntityAsync(Guid tenantId, string action, string entity, string? entityId, string? email)
    {
        await _unitOfWork.AuditLogs.AddAsync(new AuditLog
        {
            TenantId = tenantId,
            Action = action,
            Entity = entity,
            EntityId = entityId,
            Details = email
        });
    }
}
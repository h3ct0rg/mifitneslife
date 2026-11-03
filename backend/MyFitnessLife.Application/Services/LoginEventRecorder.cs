using Microsoft.Extensions.Logging;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class LoginEventRecorder : ILoginEventRecorder
{
    private const int MaxUserAgentLength = 256;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IRequestInfo _requestInfo;
    private readonly ILogger<LoginEventRecorder> _logger;

    public LoginEventRecorder(IUnitOfWork unitOfWork, IRequestInfo requestInfo, ILogger<LoginEventRecorder> logger)
    {
        _unitOfWork = unitOfWork;
        _requestInfo = requestInfo;
        _logger = logger;
    }

    public async Task RecordAsync(Guid userId, UserMembership membership, LoginMethod method)
    {
        try
        {
            await InsertAsync(userId, membership, method);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo registrar el evento de conexión {Method} del usuario {UserId}.", method, userId);
        }
    }

    public async Task RecordSessionIfFirstTodayAsync(Guid userId, UserMembership membership)
    {
        try
        {
            var todayUtc = DateTime.UtcNow.Date;
            if (await _unitOfWork.LoginEvents.ExistsForUserSinceAsync(userId, DateTime.SpecifyKind(todayUtc, DateTimeKind.Utc)))
                return;

            await InsertAsync(userId, membership, LoginMethod.Session);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo registrar el evento de sesión del usuario {UserId}.", userId);
        }
    }

    private Task InsertAsync(Guid userId, UserMembership membership, LoginMethod method)
    {
        var userAgent = _requestInfo.UserAgent;
        if (userAgent is { Length: > MaxUserAgentLength })
            userAgent = userAgent[..MaxUserAgentLength];

        return _unitOfWork.LoginEvents.AddAndSaveAsync(new LoginEvent
        {
            UserId = userId,
            TenantId = membership.TenantId,
            MembershipId = membership.Id,
            Role = membership.Role,
            Method = method,
            OccurredAt = DateTime.UtcNow,
            UserAgent = string.IsNullOrWhiteSpace(userAgent) ? null : userAgent
        });
    }
}

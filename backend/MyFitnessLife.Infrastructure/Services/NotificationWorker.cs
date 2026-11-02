using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Infrastructure.Services;

/// <summary>
/// Worker independiente que consume la cola de mensajes (Outbox) y envía
/// notificaciones (invitaciones, alertas, recordatorios) vía email.
/// </summary>
public class NotificationWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationWorker> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(15);

    public NotificationWorker(IServiceScopeFactory scopeFactory, ILogger<NotificationWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("NotificationWorker iniciado.");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en NotificationWorker.");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

        var messages = (await unitOfWork.Outbox.GetPendingDueAsync(20)).ToList();
        if (messages.Count == 0)
            return;

        foreach (var message in messages)
        {
            ct.ThrowIfCancellationRequested();
            await ProcessMessageAsync(unitOfWork, emailService, message);
        }

        await unitOfWork.SaveChangesAsync();
    }

    private async Task ProcessMessageAsync(IUnitOfWork unitOfWork, IEmailService emailService, OutboxMessage message)
    {
        message.Attempts++;

        try
        {
            var sent = await emailService.SendEmailAsync(message.Recipient, message.Subject ?? string.Empty, message.BodyHtml ?? string.Empty);

            if (sent)
            {
                message.Status = NotificationStatus.Sent;
                message.SentAt = DateTime.UtcNow;
                message.LastError = null;
                message.NextAttemptAt = null;

                await MarkInvitationSentAsync(unitOfWork, message);
            }
            else
            {
                MarkRetry(message, "SMTP devolvió error.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Fallo envío de mensaje {Id} (intento {Attempts}).", message.Id, message.Attempts);
            MarkRetry(message, ex.Message);
        }
    }

    private void MarkRetry(OutboxMessage message, string error)
    {
        message.LastError = error;
        if (message.Attempts >= 5)
        {
            message.Status = NotificationStatus.Failed;
            message.NextAttemptAt = null;
        }
        else
        {
            message.NextAttemptAt = DateTime.UtcNow.AddMinutes(Math.Pow(2, message.Attempts));
        }
    }

    private async Task MarkInvitationSentAsync(IUnitOfWork unitOfWork, OutboxMessage message)
    {
        if (message.Type != "invitation" || string.IsNullOrWhiteSpace(message.Payload))
            return;

        if (Guid.TryParse(message.Payload, out var invitationId))
        {
            var invitation = await unitOfWork.Invitations.GetByIdAsync(invitationId);
            if (invitation is not null && invitation.Status == InvitationStatus.Pending)
            {
                invitation.SentAt = DateTime.UtcNow;
                invitation.Attempts = message.Attempts;
                invitation.LastError = message.LastError;
                await unitOfWork.Invitations.UpdateAsync(invitation);
            }
        }
    }
}
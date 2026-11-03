using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public enum InvitationOutcome
{
    Sent,
    Resent,
    /// <summary>El usuario ya tiene exactamente esa membresía (tenant + rol).</summary>
    AlreadyMember
}

/// <summary>
/// Lógica compartida de invitaciones: crea o renueva una <see cref="Invitation"/>, registra
/// auditoría y encola el correo (OutboxMessage tipo "invitation") con la plantilla única de
/// <see cref="IEmailService"/>. El envío real lo hace NotificationWorker con reintentos, así que
/// un fallo SMTP nunca rompe la operación que invita.
/// Usado por UserManagementService (Usuarios) y PatientService (alta de pacientes).
/// </summary>
public sealed class InvitationDispatcher
{
    private static readonly TimeSpan Validity = TimeSpan.FromHours(24);

    private readonly IUnitOfWork _unitOfWork;
    private readonly ITenantActivityService _activityService;
    private readonly IEmailService _emailService;
    private readonly string _frontendUrl;

    public InvitationDispatcher(
        IUnitOfWork unitOfWork,
        ITenantActivityService activityService,
        IEmailService emailService,
        IConfiguration configuration)
    {
        _unitOfWork = unitOfWork;
        _activityService = activityService;
        _emailService = emailService;
        _frontendUrl = configuration["FrontendUrl"]?.TrimEnd('/') ?? "http://localhost:5173";
    }

    /// <summary>
    /// Multi-rol (D6): invitar a un email con cuenta está permitido (al aceptar se agrega la
    /// membresía). Solo si ya tiene esa misma membresía → AlreadyMember. Invitación pendiente del
    /// MISMO rol en el tenant → se reenvía (N1); si no → nueva. El email debe venir normalizado.
    /// </summary>
    public async Task<InvitationOutcome> InviteOrResendAsync(Tenant tenant, string email, UserRole role, Guid inviterId)
    {
        if (await HasMembershipAsync(email, tenant.Id, role))
            return InvitationOutcome.AlreadyMember;

        var pending = await _unitOfWork.Invitations.GetPendingByEmailAndRoleAsync(tenant.Id, email, role);
        if (pending is not null)
        {
            await ResendAsync(tenant, pending);
            return InvitationOutcome.Resent;
        }

        await CreateAsync(tenant, email, role, inviterId);
        return InvitationOutcome.Sent;
    }

    public async Task<bool> HasMembershipAsync(string email, Guid tenantId, UserRole role)
    {
        var user = await _unitOfWork.Users.GetByEmailAsync(email);
        return user is not null && await _unitOfWork.Memberships.FindAsync(user.Id, tenantId, role) is not null;
    }

    public async Task<Invitation> CreateAsync(Tenant tenant, string email, UserRole role, Guid inviterId)
    {
        if (role == UserRole.SuperAdmin)
            throw new ArgumentException("No se puede invitar a un usuario con rol SuperAdmin.");

        var invitation = new Invitation
        {
            TenantId = tenant.Id,
            Email = email,
            Role = role,
            InvitedBy = inviterId,
            Token = NewToken(),
            ExpiresAt = DateTime.UtcNow.Add(Validity),
            Status = InvitationStatus.Pending
        };

        await _unitOfWork.Invitations.AddAsync(invitation);
        await _activityService.RecordEntityAsync(tenant.Id, "invite", "User", invitation.Id.ToString(), email);
        await _unitOfWork.SaveChangesAsync();

        await EnqueueEmailAsync(tenant, invitation);
        return invitation;
    }

    /// <summary>Nuevo token y vencimiento, vuelve a Pending y encola el correo.</summary>
    public async Task ResendAsync(Tenant tenant, Invitation invitation)
    {
        invitation.Token = NewToken();
        invitation.ExpiresAt = DateTime.UtcNow.Add(Validity);
        invitation.Status = InvitationStatus.Pending;
        invitation.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Invitations.UpdateAsync(invitation);
        await _unitOfWork.SaveChangesAsync();

        await EnqueueEmailAsync(tenant, invitation);
    }

    private async Task EnqueueEmailAsync(Tenant tenant, Invitation invitation)
    {
        var acceptUrl = $"{_frontendUrl}/registro?token={invitation.Token}";
        var html = _emailService.BuildInvitationEmail(
            invitation.Email,
            invitation.Email,
            tenant.Name,
            RoleLabel(invitation.Role),
            acceptUrl);

        await _unitOfWork.Outbox.AddAsync(new OutboxMessage
        {
            TenantId = invitation.TenantId,
            Recipient = invitation.Email,
            Type = "invitation",
            Subject = $"Te han invitado a MyFitnessLife ({tenant.Name})",
            BodyHtml = html,
            Payload = invitation.Id.ToString(),
            Status = NotificationStatus.Pending
        });

        await _unitOfWork.SaveChangesAsync();
    }

    public static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;
        try
        {
            return new MailAddress(email).Address == email;
        }
        catch
        {
            return false;
        }
    }

    private static string NewToken() => Guid.NewGuid().ToString("N");

    private static string RoleLabel(UserRole role) => role switch
    {
        UserRole.Admin => "Administrador",
        UserRole.Nutritionist => "Nutricionista",
        UserRole.Trainer => "Entrenador",
        UserRole.Patient => "Paciente",
        _ => role.ToString()
    };
}

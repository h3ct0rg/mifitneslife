using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Constants;
using System.Net;
using System.Net.Mail;

namespace MyFitnessLife.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly SmtpSettings _settings;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<SmtpSettings> settings, ILogger<EmailService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<bool> SendEmailAsync(string to, string subject, string htmlBody)
    {
        try
        {
            using var client = new SmtpClient(_settings.Server, _settings.Port)
            {
                Credentials = new NetworkCredential(_settings.SenderEmail, _settings.Password),
                EnableSsl = _settings.EnableSsl,
                Timeout = 20000
            };

            using var message = new MailMessage
            {
                From = new MailAddress(_settings.SenderEmail, _settings.SenderName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            message.To.Add(to);

            await client.SendMailAsync(message);
            _logger.LogInformation("Email enviado a {To}: {Subject}", to, subject);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error enviando email a {To}: {Subject}", to, subject);
            return false;
        }
    }

    public string BuildInvitationEmail(string inviteeName, string inviteeEmail, string tenantName, string roleLabel, string acceptUrl)
    {
        var displayName = string.IsNullOrWhiteSpace(inviteeName) ? inviteeEmail : inviteeName;
        const string template = """
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="utf-8"/></head>
            <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:24px 0;">
                <tr><td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;">
                    <tr>
                      <td style="padding:28px 32px 8px;">
                        <div style="font-size:22px;font-weight:700;color:#22c55e;">MyFitnessLife</div>
                        <div style="font-size:13px;color:#94a3b8;margin-top:2px;">Plataforma de Fitness &amp; Nutrición</div>
                      </td>
                    </tr>
                    <tr><td style="padding:20px 32px;color:#e2e8f0;">
                      <h2 style="margin:0 0 12px;color:#e2e8f0;font-size:20px;">Te han invitado a unirte</h2>
                      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cbd5e1;">
                        Hola <strong style="color:#e2e8f0;">{{DISPLAY_NAME}}</strong>,<br/><br/>
                        Se te ha invitado a la plataforma <strong style="color:#22c55e;">{{TENANT_NAME}}</strong> con el rol de
                        <strong style="color:#e2e8f0;">{{ROLE_LABEL}}</strong>.
                      </p>
                      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#cbd5e1;">
                        Para completar tu registro y empezar a usar la plataforma, haz clic en el botón de abajo.
                        El enlace es válido por <strong>24 horas</strong>.
                      </p>
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
                        <tr>
                          <td style="border-radius:8px;background-color:#22c55e;padding:12px 28px;">
                            <a href="{{ACCEPT_URL}}" style="display:inline-block;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">Aceptar invitación</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
                        Si no puedes ver el botón, copia y pega este enlace en tu navegador:<br/>
                        <span style="color:#cbd5e1;word-break:break-all;">{{ACCEPT_URL}}</span>
                      </p>
                    </td></tr>
                    <tr>
                      <td style="padding:16px 32px;background-color:#0f172a;border-top:1px solid #334155;">
                        <div style="font-size:12px;color:#94a3b8;">© {{YEAR}} MyFitnessLife · Este correo fue enviado automáticamente, por favor no respondas.</div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;

        return template
            .Replace("{{DISPLAY_NAME}}", displayName)
            .Replace("{{TENANT_NAME}}", tenantName)
            .Replace("{{ROLE_LABEL}}", roleLabel)
            .Replace("{{ACCEPT_URL}}", acceptUrl)
            .Replace("{{YEAR}}", DateTime.UtcNow.Year.ToString());
    }

    public string BuildAppointmentEmail(string patientName, string professionalName, string dateLabel, string timeLabel, string? title, string? notes)
    {
        const string template = """
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="utf-8"/></head>
            <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:24px 0;">
                <tr><td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;">
                    <tr>
                      <td style="padding:28px 32px 8px;">
                        <div style="font-size:22px;font-weight:700;color:#22c55e;">MyFitnessLife</div>
                        <div style="font-size:13px;color:#94a3b8;margin-top:2px;">Plataforma de Fitness &amp; Nutrición</div>
                      </td>
                    </tr>
                    <tr><td style="padding:20px 32px;color:#e2e8f0;">
                      <h2 style="margin:0 0 12px;color:#e2e8f0;font-size:20px;">Cita programada</h2>
                      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cbd5e1;">
                        Hola <strong style="color:#e2e8f0;">{{PATIENT_NAME}}</strong>,<br/><br/>
                        Te informamos que tienes una cita programada con
                        <strong style="color:#22c55e;">{{PROFESSIONAL_NAME}}</strong>.
                      </p>
                      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
                        <tr>
                          <td style="padding:10px 16px;background-color:#0f172a;border:1px solid #334155;border-radius:8px 0 0 8px;width:120px;font-size:12px;color:#94a3b8;">Fecha</td>
                          <td style="padding:10px 16px;background-color:#0f172a;border:1px solid #334155;border-left:none;border-radius:0 8px 8px 0;font-size:14px;color:#e2e8f0;"><strong>{{DATE}}</strong></td>
                        </tr>
                        <tr><td colspan="2" style="height:8px;"></td></tr>
                        <tr>
                          <td style="padding:10px 16px;background-color:#0f172a;border:1px solid #334155;border-radius:8px 0 0 8px;width:120px;font-size:12px;color:#94a3b8;">Hora</td>
                          <td style="padding:10px 16px;background-color:#0f172a;border:1px solid #334155;border-left:none;border-radius:0 8px 8px 0;font-size:14px;color:#e2e8f0;"><strong>{{TIME}}</strong></td>
                        </tr>
                      </table>
                      {{TITLE_HTML}}
                      {{NOTES_HTML}}
                      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
                        Por favor llega con algunos minutos de anticipación. Si necesitas reprogramar,
                        contacta con el centro.
                      </p>
                    </td></tr>
                    <tr>
                      <td style="padding:16px 32px;background-color:#0f172a;border-top:1px solid #334155;">
                        <div style="font-size:12px;color:#94a3b8;">© {{YEAR}} MyFitnessLife · Este correo fue enviado automáticamente, por favor no respondas.</div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;

        var titleHtml = string.IsNullOrWhiteSpace(title)
            ? string.Empty
            : $"""
               <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;"><strong>Título:</strong> {title}</p>
               """;
        var notesHtml = string.IsNullOrWhiteSpace(notes)
            ? string.Empty
            : $"""
               <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#cbd5e1;"><strong>Notas:</strong> {notes}</p>
               """;

        return template
            .Replace("{{PATIENT_NAME}}", patientName)
            .Replace("{{PROFESSIONAL_NAME}}", professionalName)
            .Replace("{{DATE}}", dateLabel)
            .Replace("{{TIME}}", timeLabel)
            .Replace("{{TITLE_HTML}}", titleHtml)
            .Replace("{{NOTES_HTML}}", notesHtml)
            .Replace("{{YEAR}}", DateTime.UtcNow.Year.ToString());
    }
}
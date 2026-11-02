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

    // ─── Shared layout helpers ──────────────────────────────────────────────────

    /// <summary>
    /// Wraps any body HTML with the full branded email shell:
    /// gradient header, white body area, and dark footer.
    /// </summary>
    private static string WrapEmailShell(string headerTitle, string headerSubtitle, string bodyHtml, int year)
    {
        return $"""
            <!DOCTYPE html>
            <html lang="es" xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="utf-8"/>
              <meta name="viewport" content="width=device-width,initial-scale=1"/>
              <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
              <title>{headerTitle}</title>
            </head>
            <body style="margin:0;padding:0;background-color:#E4ECF7;font-family:'Segoe UI',Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%;">

              <!-- Outer wrapper -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#E4ECF7"
                     style="background:linear-gradient(135deg,#EAF1FB 0%,#DCE9FA 50%,#CFE3FB 100%);padding:32px 16px;">
                <tr><td align="center">

                  <!-- Card -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                         style="max-width:580px;border-radius:20px;overflow:hidden;
                                box-shadow:0 20px 50px rgba(15,23,42,0.12),0 4px 20px rgba(0,120,212,0.15);
                                border:1px solid rgba(0,120,212,0.15);">

                    <!-- ═══ HEADER ═══ -->
                    <tr>
                      <td bgcolor="#0078D4" style="background:linear-gradient(135deg,#0078D4 0%,#0098FF 100%);
                                 padding:36px 40px 32px;">
                        <!-- Logo row -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td>
                              <!-- Logo mark -->
                              <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.3);
                                             border-radius:10px;padding:8px 12px;vertical-align:middle;">
                                    <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">MFL</span>
                                  </td>
                                  <td style="padding-left:12px;vertical-align:middle;">
                                    <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">MyFitnessLife</div>
                                    <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:1px;letter-spacing:0.2px;">Fitness &amp; Nutrición Profesional</div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- Divider -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                               style="margin:24px 0 20px;">
                          <tr>
                            <td style="background:linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent);
                                       height:1px;font-size:0;line-height:0;">&nbsp;</td>
                          </tr>
                        </table>

                        <!-- Title block -->
                        <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">{headerTitle}</div>
                        <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:6px;line-height:1.5;">{headerSubtitle}</div>
                      </td>
                    </tr>

                    <!-- ═══ BODY ═══ -->
                    <tr>
                      <td style="background:#ffffff;padding:36px 40px;">
                        {bodyHtml}
                      </td>
                    </tr>

                    <!-- ═══ FOOTER ═══ -->
                    <tr>
                      <td bgcolor="#F6F9FE" style="background:#F6F9FE;border-top:1px solid #E2E8F0;padding:20px 40px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td>
                              <div style="font-size:11px;color:#64748b;line-height:1.6;">
                                © {year} <span style="color:#0078D4;font-weight:600;">MyFitnessLife</span> · Todos los derechos reservados.<br/>
                                Este correo fue generado automáticamente — por favor no respondas a este mensaje.
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                  </table><!-- /Card -->

                </td></tr>
              </table><!-- /Outer wrapper -->

            </body>
            </html>
            """;
    }

    // ─── Invitation Email ────────────────────────────────────────────────────────

    public string BuildInvitationEmail(string inviteeName, string inviteeEmail, string tenantName, string roleLabel, string acceptUrl)
    {
        var displayName = string.IsNullOrWhiteSpace(inviteeName) ? inviteeEmail : inviteeName;
        var year = DateTime.UtcNow.Year;

        var body = $"""
            <!-- Greeting -->
            <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">
              ¡Hola, <span style="color:#0078D4;">{displayName}</span>!
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569;">
              Has recibido una invitación para unirte a la plataforma de salud y bienestar.
              A continuación encontrarás los detalles de tu acceso.
            </p>

            <!-- Info card -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                   style="margin:0 0 28px;border-radius:12px;overflow:hidden;
                          border:1px solid #e2e8f0;background:#f8fafc;">
              <tr>
                <td style="background:linear-gradient(135deg,#eff6ff,#dbeafe);
                           padding:20px 24px;border-bottom:1px solid #e2e8f0;">
                  <div style="font-size:11px;font-weight:700;color:#0078D4;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Tu acceso</div>
                  <div style="font-size:16px;font-weight:700;color:#0f172a;">{tenantName}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:16px 24px;border-bottom:1px solid #f1f5f9;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="width:36px;vertical-align:top;padding-top:1px;">
                              <div style="width:28px;height:28px;border-radius:8px;background:#eff6ff;
                                          border:1px solid #dbeafe;text-align:center;line-height:28px;font-size:14px;">&#128100;</div>
                            </td>
                            <td style="padding-left:12px;vertical-align:top;">
                              <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px;">Correo</div>
                              <div style="font-size:14px;color:#0f172a;font-weight:500;">{inviteeEmail}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 24px;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="width:36px;vertical-align:top;padding-top:1px;">
                              <div style="width:28px;height:28px;border-radius:8px;background:#eff6ff;
                                          border:1px solid #dbeafe;text-align:center;line-height:28px;font-size:14px;">&#127775;</div>
                            </td>
                            <td style="padding-left:12px;vertical-align:top;">
                              <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px;">Rol asignado</div>
                              <div style="display:inline-block;font-size:13px;font-weight:700;color:#0078D4;
                                          background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;
                                          padding:3px 12px;">{roleLabel}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table><!-- /Info card -->

            <!-- Expiry notice -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                   style="margin:0 0 28px;border-radius:10px;border:1px solid #fde68a;background:#fefce8;">
              <tr>
                <td style="padding:14px 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:18px;vertical-align:middle;padding-right:10px;">&#9888;&#65039;</td>
                      <td style="font-size:13px;color:#78350f;line-height:1.5;vertical-align:middle;">
                        Este enlace de invitación es válido por <strong>24 horas</strong>.
                        Si expira, solicita una nueva invitación al administrador.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                   style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-radius:10px;background:linear-gradient(135deg,#0078D4,#005A9E);
                                 box-shadow:0 4px 16px rgba(0,120,212,0.4);">
                        <a href="{acceptUrl}"
                           style="display:inline-block;padding:15px 40px;
                                  color:#ffffff;text-decoration:none;
                                  font-size:16px;font-weight:700;letter-spacing:0.2px;">
                          &#10003; &nbsp;Aceptar invitación
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Fallback URL -->
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
              ¿No ves el botón? Copia y pega este enlace en tu navegador:<br/>
              <span style="color:#0078D4;word-break:break-all;font-size:11px;">{acceptUrl}</span>
            </p>
            """;

        return WrapEmailShell(
            "Invitación a la plataforma",
            $"Tienes una invitación pendiente en {tenantName}",
            body,
            year);
    }

    // ─── Appointment Email ───────────────────────────────────────────────────────

    public string BuildAppointmentEmail(string patientName, string professionalName, string dateLabel, string timeLabel, string? title, string? notes)
    {
        var year = DateTime.UtcNow.Year;

        var titleRow = string.IsNullOrWhiteSpace(title) ? string.Empty : $"""
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px;vertical-align:top;padding-top:1px;">
                      <div style="width:28px;height:28px;border-radius:8px;background:#eff6ff;
                                  border:1px solid #dbeafe;text-align:center;line-height:28px;font-size:14px;">&#128203;</div>
                    </td>
                    <td style="padding-left:12px;vertical-align:top;">
                      <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px;">Motivo / Título</div>
                      <div style="font-size:14px;color:#0f172a;font-weight:600;">{title}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            """;

        var notesRow = string.IsNullOrWhiteSpace(notes) ? string.Empty : $"""
            <tr>
              <td style="padding:14px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px;vertical-align:top;padding-top:1px;">
                      <div style="width:28px;height:28px;border-radius:8px;background:#eff6ff;
                                  border:1px solid #dbeafe;text-align:center;line-height:28px;font-size:14px;">&#128172;</div>
                    </td>
                    <td style="padding-left:12px;vertical-align:top;">
                      <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px;">Notas</div>
                      <div style="font-size:13px;color:#475569;line-height:1.6;">{notes}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            """;

        var body = $"""
            <!-- Greeting -->
            <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">
              ¡Hola, <span style="color:#0078D4;">{patientName}</span>!
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569;">
              Tu cita ha sido confirmada. Aquí tienes todos los detalles para que no te pierdas nada.
            </p>

            <!-- Professional pill -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="border-radius:20px;background:linear-gradient(135deg,#eff6ff,#dbeafe);
                           border:1px solid #bfdbfe;padding:8px 18px 8px 14px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:16px;vertical-align:middle;padding-right:8px;">&#128084;</td>
                      <td style="vertical-align:middle;">
                        <span style="font-size:12px;color:#64748b;">Profesional: </span>
                        <span style="font-size:14px;font-weight:700;color:#0078D4;">{professionalName}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Appointment detail card -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                   style="margin:0 0 28px;border-radius:12px;overflow:hidden;
                          border:1px solid #e2e8f0;background:#f8fafc;">
              <!-- Card header -->
              <tr>
                <td style="background:linear-gradient(135deg,#eff6ff,#dbeafe);
                           padding:16px 24px;border-bottom:1px solid #e2e8f0;">
                  <div style="font-size:11px;font-weight:700;color:#0078D4;letter-spacing:1px;text-transform:uppercase;">
                    &#128197; &nbsp;Detalles de la cita
                  </div>
                </td>
              </tr>
              <!-- Date row -->
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:36px;vertical-align:top;padding-top:1px;">
                        <div style="width:28px;height:28px;border-radius:8px;background:#eff6ff;
                                    border:1px solid #dbeafe;text-align:center;line-height:28px;font-size:14px;">&#128197;</div>
                      </td>
                      <td style="padding-left:12px;vertical-align:top;">
                        <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px;">Fecha</div>
                        <div style="font-size:15px;color:#0f172a;font-weight:700;">{dateLabel}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Time row -->
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:36px;vertical-align:top;padding-top:1px;">
                        <div style="width:28px;height:28px;border-radius:8px;background:#eff6ff;
                                    border:1px solid #dbeafe;text-align:center;line-height:28px;font-size:14px;">&#128336;</div>
                      </td>
                      <td style="padding-left:12px;vertical-align:top;">
                        <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px;">Hora</div>
                        <div style="font-size:15px;color:#0f172a;font-weight:700;">{timeLabel}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              {titleRow}
              {notesRow}
            </table><!-- /Detail card -->

            <!-- Reminder notice -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                   style="margin:0 0 8px;border-radius:10px;border:1px solid #d1fae5;background:#f0fdf4;">
              <tr>
                <td style="padding:14px 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:18px;vertical-align:middle;padding-right:10px;">&#9989;</td>
                      <td style="font-size:13px;color:#064e3b;line-height:1.5;vertical-align:middle;">
                        Por favor <strong>llega con algunos minutos de anticipación</strong>.
                        Si necesitas reprogramar, contacta con el centro a la brevedad posible.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            """;

        return WrapEmailShell(
            "Tu cita está confirmada",
            $"Cita con {professionalName} · {dateLabel} a las {timeLabel}",
            body,
            year);
    }
}
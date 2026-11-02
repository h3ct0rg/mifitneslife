namespace MyFitnessLife.Application.Interfaces;

public interface IEmailService
{
    Task<bool> SendEmailAsync(string to, string subject, string htmlBody);
    string BuildInvitationEmail(string inviteeName, string inviteeEmail, string tenantName, string roleLabel, string acceptUrl);
    string BuildAppointmentEmail(string patientName, string professionalName, string dateLabel, string timeLabel, string? title, string? notes);
}
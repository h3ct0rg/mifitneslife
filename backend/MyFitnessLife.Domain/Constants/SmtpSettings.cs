namespace MyFitnessLife.Domain.Constants;

public class SmtpSettings
{
    public string Server { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string SenderName { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool EnableSsl { get; set; } = true;

    /// <summary>
    /// Solo para demos/QA: si tiene valor, TODO correo se envía a esta dirección en lugar del
    /// destinatario real y el asunto se antepone con "[Para: original] ". Vacío por defecto; NO
    /// configurarlo en appsettings commiteados: activar con la variable de entorno
    /// SmtpSettings__RedirectAllTo.
    /// </summary>
    public string? RedirectAllTo { get; set; }
}
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Services;

/// <summary>Datos de la petición HTTP actual para la capa de aplicación (User-Agent del LoginEvent).</summary>
public sealed class HttpRequestInfo : IRequestInfo
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpRequestInfo(IHttpContextAccessor httpContextAccessor) => _httpContextAccessor = httpContextAccessor;

    public string? UserAgent => _httpContextAccessor.HttpContext?.Request.Headers.UserAgent.ToString();
}

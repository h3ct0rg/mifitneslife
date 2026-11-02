using System.Text.Json;
using System.Text.Json.Serialization;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.Infrastructure.Auth;

public class GoogleAuthOptions
{
    public GoogleAuthOptions(string clientId) => ClientId = clientId;
    public string ClientId { get; }
}

public class GoogleAuthService : IGoogleAuthService
{
    private readonly HttpClient _httpClient;
    private readonly GoogleAuthOptions _options;

    public GoogleAuthService(HttpClient httpClient, GoogleAuthOptions options)
    {
        _httpClient = httpClient;
        _options = options;
    }

    public async Task<GoogleUserPayload> ValidateIdTokenAsync(string idToken)
    {
        if (string.IsNullOrWhiteSpace(idToken))
            throw new UnauthorizedAccessException("Token de Google no proporcionado.");

        try
        {
            var url = $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}";
            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
                throw new UnauthorizedAccessException("Token de Google inválido.");

            var json = await response.Content.ReadAsStringAsync();
            var payload = JsonSerializer.Deserialize<GoogleTokenInfo>(json)
                ?? throw new UnauthorizedAccessException("Token de Google inválido.");

            if (!string.Equals(payload.Aud, _options.ClientId, StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("El token de Google no corresponde a esta aplicación.");

            return new GoogleUserPayload(
                payload.Sub,
                (payload.Email ?? string.Empty).ToLowerInvariant(),
                payload.GivenName ?? string.Empty,
                payload.FamilyName ?? string.Empty);
        }
        catch (UnauthorizedAccessException)
        {
            throw;
        }
        catch
        {
            throw new UnauthorizedAccessException("No se pudo validar el token de Google.");
        }
    }

    private class GoogleTokenInfo
    {
        [JsonPropertyName("sub")] public string Sub { get; set; } = string.Empty;
        [JsonPropertyName("aud")] public string Aud { get; set; } = string.Empty;
        [JsonPropertyName("email")] public string? Email { get; set; }
        [JsonPropertyName("given_name")] public string? GivenName { get; set; }
        [JsonPropertyName("family_name")] public string? FamilyName { get; set; }
    }
}
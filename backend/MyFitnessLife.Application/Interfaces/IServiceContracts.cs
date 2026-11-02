using MyFitnessLife.Application.DTOs.Auth;

namespace MyFitnessLife.Application.Interfaces;

public interface ITokenService
{
    Task<TokenResponse> CreateTokenPairAsync(Guid userId);
    string GenerateRefreshToken();
    Guid? GetUserIdFromExpiredToken(string accessToken);
    ClaimsPrincipalResult GetPrincipal(string token);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public record GoogleUserPayload(string Subject, string Email, string FirstName, string LastName);

public interface IGoogleAuthService
{
    Task<GoogleUserPayload> ValidateIdTokenAsync(string idToken);
}

public record ClaimsPrincipalResult(bool Valid, Guid UserId);
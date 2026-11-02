using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Interfaces;
using IdentityPasswordHasher = Microsoft.AspNetCore.Identity.IPasswordHasher<MyFitnessLife.Domain.Entities.ApplicationUser>;

namespace MyFitnessLife.Infrastructure.Auth;

public class JwtOptions
{
    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int ExpiryInMinutes { get; set; } = 1440;
    public int RefreshTokenExpiryInDays { get; set; } = 7;
}

public class PasswordHasher : IPasswordHasher
{
    private static readonly IdentityPasswordHasher IdentityHasher =
        new Microsoft.AspNetCore.Identity.PasswordHasher<ApplicationUser>();

    public string Hash(string password)
        => IdentityHasher.HashPassword(null!, password);

    public bool Verify(string password, string hash)
        => IdentityHasher.VerifyHashedPassword(null!, hash, password)
           != Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed;
}

public class TokenService : ITokenService
{
    private readonly JwtOptions _options;
    private readonly IUnitOfWork _unitOfWork;

    public TokenService(IOptions<JwtOptions> options, IUnitOfWork unitOfWork)
    {
        _options = options.Value;
        _unitOfWork = unitOfWork;
    }

    public async Task<TokenResponse> CreateTokenPairAsync(Guid userId)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(userId)
            ?? throw new UnauthorizedAccessException("Usuario no encontrado.");

        var accessToken = GenerateAccessToken(user);
        var refreshToken = GenerateRefreshToken();

        await _unitOfWork.RefreshTokens.AddAsync(new RefreshToken
        {
            UserId = userId,
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(_options.RefreshTokenExpiryInDays)
        });
        await _unitOfWork.SaveChangesAsync();

        var expiresAt = DateTime.UtcNow.AddMinutes(_options.ExpiryInMinutes);
        return new TokenResponse(accessToken, refreshToken, expiresAt);
    }

    private string GenerateAccessToken(ApplicationUser user)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new("name", user.FullName),
            new("role", user.Role.ToString()),
            new("tenant_id", user.TenantId?.ToString() ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_options.ExpiryInMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    public Guid? GetUserIdFromExpiredToken(string accessToken)
    {
        var principal = GetPrincipal(accessToken);
        return principal.Valid ? principal.UserId : null;
    }

    public ClaimsPrincipalResult GetPrincipal(string token)
    {
        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = false,
            ValidIssuer = _options.Issuer,
            ValidAudience = _options.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key))
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        try
        {
            var principal = tokenHandler.ValidateToken(token, tokenValidationParameters,
                out var validatedToken);
            var userIdRaw = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
            return Guid.TryParse(userIdRaw, out var userId)
                ? new ClaimsPrincipalResult(true, userId)
                : new ClaimsPrincipalResult(false, Guid.Empty);
        }
        catch
        {
            return new ClaimsPrincipalResult(false, Guid.Empty);
        }
    }
}
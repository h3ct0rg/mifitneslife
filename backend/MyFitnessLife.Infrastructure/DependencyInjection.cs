using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Interfaces;
using MyFitnessLife.Infrastructure.Auth;
using MyFitnessLife.Infrastructure.Data;
using MyFitnessLife.Infrastructure.Repositories;

namespace MyFitnessLife.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddHttpClient<IGoogleAuthService, GoogleAuthService>((sp, client) =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        services.AddSingleton(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            return new GoogleAuthOptions(config["GoogleAuth:ClientId"] ?? string.Empty);
        });

        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddScoped<ITokenService, TokenService>();

        return services;
    }
}
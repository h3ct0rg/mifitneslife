using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Minio;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Constants;
using MyFitnessLife.Domain.Interfaces;
using MyFitnessLife.Infrastructure.Auth;
using MyFitnessLife.Infrastructure.Data;
using MyFitnessLife.Infrastructure.Repositories;
using MyFitnessLife.Infrastructure.Services;

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

        services.Configure<MinioSettings>(configuration.GetSection("Minio"));
        services.AddScoped<IMinioService, MinioService>();
        services.Configure<ExerciseDatasetOptions>(configuration.GetSection("ExerciseDataset"));

        var minioSection = configuration.GetSection("Minio");
        var minioOptions = minioSection.Get<MinioSettings>() ?? new MinioSettings();
        services.AddSingleton<IMinioClient>(sp => new MinioClient()
            .WithEndpoint(minioOptions.Endpoint)
            .WithCredentials(minioOptions.AccessKey, minioOptions.SecretKey)
            .WithSSL(minioOptions.UseSSL)
            .Build());

        return services;
    }
}
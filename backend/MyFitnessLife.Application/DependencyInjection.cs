using Microsoft.Extensions.DependencyInjection;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Application.Services;

namespace MyFitnessLife.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddAutoMapper(cfg => cfg.AddProfile<Mapping.MappingProfile>());

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<ISuperAdminService, SuperAdminService>();
        services.AddScoped<ITenantActivityService, TenantActivityService>();
        services.AddScoped<IPatientService, PatientService>();

        return services;
    }
}
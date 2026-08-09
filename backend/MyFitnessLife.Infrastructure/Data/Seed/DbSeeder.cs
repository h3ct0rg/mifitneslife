using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.Infrastructure.Data.Seed;

public static class DbSeeder
{
    public static async Task SeedAsync(
        AppDbContext context,
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        IConfiguration configuration)
    {
        await context.Database.MigrateAsync();

        var allRoles = Enum.GetValues<UserRole>();
        foreach (var role in allRoles)
        {
            if (!await roleManager.RoleExistsAsync(role.ToString()))
                await roleManager.CreateAsync(new ApplicationRole(role.ToString()));
        }

        var seedSection = configuration.GetSection("Seed");
        var demoPassword = seedSection["DemoPassword"] ?? "admin";
        var superAdminPassword = seedSection["SuperAdminPassword"] ?? "superadmin";

        var demoTenant = await context.Tenants.FirstOrDefaultAsync(t => t.Slug == "demo");
        if (demoTenant is null)
        {
            demoTenant = new Tenant
            {
                Name = "Clinica Demo",
                Slug = "demo",
                Description = "Tenant de demostración",
                IsActive = true
            };
            await context.Tenants.AddAsync(demoTenant);
            await context.SaveChangesAsync();
        }

        var superAdmin = await userManager.FindByEmailAsync("superadmin@admin.com");
        if (superAdmin is null)
        {
            superAdmin = new ApplicationUser
            {
                UserName = "superadmin@admin.com",
                Email = "superadmin@admin.com",
                FirstName = "Super",
                LastName = "Admin",
                Role = UserRole.SuperAdmin,
                Status = UserStatus.Active
            };
            await userManager.CreateAsync(superAdmin, superAdminPassword);
            await userManager.AddToRoleAsync(superAdmin, UserRole.SuperAdmin.ToString());
        }

        var tenantAdmin = await userManager.FindByEmailAsync("admin@admin.com");
        if (tenantAdmin is null)
        {
            tenantAdmin = new ApplicationUser
            {
                UserName = "admin@admin.com",
                Email = "admin@admin.com",
                FirstName = "Admin",
                LastName = "Demo",
                TenantId = demoTenant.Id,
                Role = UserRole.Admin,
                Status = UserStatus.Active
            };
            await userManager.CreateAsync(tenantAdmin, demoPassword);
            await userManager.AddToRoleAsync(tenantAdmin, UserRole.Admin.ToString());
        }
    }
}
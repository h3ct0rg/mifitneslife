using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Infrastructure;
using MyFitnessLife.Infrastructure.Auth;
using MyFitnessLife.Infrastructure.Data;
using MyFitnessLife.Infrastructure.Data.Seed;
using MyFitnessLife.Application;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Services.AddSerilog((services, cfg) =>
{
    cfg.ReadFrom.Configuration(builder.Configuration)
       .WriteTo.Console()
       .WriteTo.File("logs/myfitnesslife-.log", rollingInterval: RollingInterval.Day);
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "MyFitnessLife API",
        Version = "v1",
        Description = "Backend de la plataforma Fitness & Nutrición"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Ingrese el token JWT."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtOptions = jwtSection.Get<JwtOptions>() ?? new JwtOptions();

builder.Services.AddIdentity<ApplicationUser, ApplicationRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 4;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key))
        };
    });

// Policy "StaffOnly" (Admin/Nutritionist/Trainer del tenant) + contexto del usuario actual (paciente propio).
builder.Services.AddAuthorization(MyFitnessLife.API.Authorization.AuthPolicies.AddStaffOnly);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<MyFitnessLife.API.Authorization.ICurrentUser, MyFitnessLife.API.Authorization.CurrentUser>();

// Reloj del cliente (header X-Time-Zone). TimeProvider sustituible: en Development se puede fijar la
// hora con Clock:FixedUtcNow (p. ej. Clock__FixedUtcNow=2026-12-01T03:30:00Z) para pruebas.
var fixedUtcNow = builder.Configuration["Clock:FixedUtcNow"];
if (builder.Environment.IsDevelopment() && DateTimeOffset.TryParse(fixedUtcNow, out var fixedNow))
    builder.Services.AddSingleton<TimeProvider>(new MyFitnessLife.API.Services.FixedTimeProvider(fixedNow));
else
    builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<MyFitnessLife.Application.Interfaces.IClientClock, MyFitnessLife.API.Services.ClientClock>();

var allowedOrigins = (builder.Configuration["FrontendUrl"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader() // incluye X-Time-Zone
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

app.UseMiddleware<MyFitnessLife.API.Middleware.ExceptionHandlingMiddleware>();

// Archivos subidos (fotos de perfil, etc.)
app.UseStaticFiles();

// CORS debe ejecutarse antes de redirecciones HTTPS para no romper los preflight OPTIONS
app.UseCors("Frontend");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Seed
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
    var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    await DbSeeder.SeedAsync(context, userManager, roleManager, config);
}

await app.RunAsync();

// Needed for Identity migrations at design time
public partial class Program { }
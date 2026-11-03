using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.API.Authorization;

/// <summary>Nombres de policies de autorización registradas en Program.cs.</summary>
public static class AuthPolicies
{
    /// <summary>Staff del tenant: Admin, Nutritionist o Trainer con claim tenant_id válido.</summary>
    public const string StaffOnly = "StaffOnly";

    public static readonly string[] StaffRoles =
    {
        nameof(UserRole.Admin),
        nameof(UserRole.Nutritionist),
        nameof(UserRole.Trainer)
    };

    public static void AddStaffOnly(AuthorizationOptions options)
    {
        options.AddPolicy(StaffOnly, policy => policy
            .RequireAuthenticatedUser()
            .RequireRole(StaffRoles)
            .RequireAssertion(ctx => CurrentUser.ParseTenantId(ctx.User) is not null));
    }
}

/// <summary>Contexto del usuario autenticado en la request actual (claims + paciente propio).</summary>
public interface ICurrentUser
{
    /// <summary>tenant_id del token; null si falta, es inválido o es Guid.Empty (p. ej. SuperAdmin).</summary>
    Guid? TenantId { get; }
    string? Email { get; }
    bool IsStaff { get; }
    bool IsPatient { get; }

    /// <summary>Paciente propio: Patient del tenant con el email del token (misma lógica que GET patients/me). Cacheado por request.</summary>
    Task<PatientDto?> GetOwnPatientAsync();
    Task<Guid?> GetOwnPatientIdAsync();

    /// <summary>Staff del tenant → true; Patient → solo si patientId es su propio paciente; resto → false.</summary>
    Task<bool> CanAccessPatientAsync(Guid patientId);
}

public sealed class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IPatientService _patientService;

    private bool _ownPatientLoaded;
    private PatientDto? _ownPatient;

    public CurrentUser(IHttpContextAccessor httpContextAccessor, IPatientService patientService)
    {
        _httpContextAccessor = httpContextAccessor;
        _patientService = patientService;
    }

    private ClaimsPrincipal User => _httpContextAccessor.HttpContext?.User ?? new ClaimsPrincipal();

    public Guid? TenantId => ParseTenantId(User);

    public string? Email => User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");

    public bool IsStaff => TenantId is not null && AuthPolicies.StaffRoles.Any(User.IsInRole);

    public bool IsPatient => !IsStaff && TenantId is not null && User.IsInRole(nameof(UserRole.Patient));

    public async Task<PatientDto?> GetOwnPatientAsync()
    {
        if (_ownPatientLoaded)
            return _ownPatient;

        _ownPatientLoaded = true;
        var tenantId = TenantId;
        var email = Email;
        if (tenantId is null || string.IsNullOrWhiteSpace(email))
            return null;

        _ownPatient = await _patientService.GetByEmailAsync(tenantId.Value, email);
        return _ownPatient;
    }

    public async Task<Guid?> GetOwnPatientIdAsync() => (await GetOwnPatientAsync())?.Id;

    public async Task<bool> CanAccessPatientAsync(Guid patientId)
    {
        if (IsStaff)
            return true;
        if (!IsPatient)
            return false;

        var ownId = await GetOwnPatientIdAsync();
        return ownId is not null && ownId.Value == patientId;
    }

    internal static Guid? ParseTenantId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("tenant_id");
        return Guid.TryParse(raw, out var tenantId) && tenantId != Guid.Empty ? tenantId : null;
    }
}

using MyFitnessLife.API.Authorization;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.API.Middleware;

/// <summary>
/// Bloqueo por suscripción (U1/AC-7). Con la suscripción del tenant de la membresía actual
/// vencida (o inexistente): staff (Admin/Nutritionist/Trainer) → 403 en todo; Patient → 403 solo
/// en métodos que no son de lectura. Exentos: /api/auth/*, /api/admin/*, /health,
/// POST /api/users/accept-invitation, GET /api/users/me, GET /api/plans, rutas fuera de
/// /api, peticiones anónimas y usuarios sin tenant (SuperAdmin).
/// Va después de UseAuthentication/UseAuthorization (necesita el usuario ya autenticado).
/// </summary>
public class SubscriptionGuardMiddleware
{
    public const string ErrorCode = "subscription_expired";
    public const string ErrorMessage = "La suscripción de este centro venció. Contacta al administrador de la plataforma.";

    private static readonly string[] ExemptPrefixes = ["/api/auth", "/api/admin", "/health"];

    /// <summary>
    /// Acciones de identidad fuera de /api/auth (no operan sobre el tenant actual): aceptar una
    /// invitación a otro centro (agrega membresía) y el perfil propio (equivalente a /auth/me).
    /// Ruta exacta + método; el resto de /api/users (invitar, roles…) sí se bloquea.
    /// </summary>
    private static readonly (string Method, string Path)[] ExemptEndpoints =
    [
        ("POST", "/api/users/accept-invitation"),
        ("GET", "/api/users/me"),
        // Catálogo público de la landing: no depende del tenant (también con token de un centro vencido).
        ("GET", "/api/plans")
    ];

    private readonly RequestDelegate _next;

    public SubscriptionGuardMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, ISubscriptionGate gate)
    {
        if (await ShouldBlockAsync(context, gate))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            // "error" duplica el mensaje para los manejadores genéricos del frontend ({ error }).
            await context.Response.WriteAsJsonAsync(new { code = ErrorCode, message = ErrorMessage, error = ErrorMessage });
            return;
        }

        await _next(context);
    }

    private static async Task<bool> ShouldBlockAsync(HttpContext context, ISubscriptionGate gate)
    {
        var path = context.Request.Path;
        if (!path.StartsWithSegments("/api") || ExemptPrefixes.Any(p => path.StartsWithSegments(p)))
            return false;
        if (HttpMethods.IsOptions(context.Request.Method))
            return false;
        if (ExemptEndpoints.Any(e => HttpMethods.Equals(e.Method, context.Request.Method)
                && path.Equals(e.Path, StringComparison.OrdinalIgnoreCase)))
            return false;

        var user = context.User;
        if (user.Identity?.IsAuthenticated != true || user.IsInRole(nameof(UserRole.SuperAdmin)))
            return false;

        var tenantId = CurrentUser.ParseTenantId(user);
        if (tenantId is null)
            return false;

        var isStaff = AuthPolicies.StaffRoles.Any(user.IsInRole);
        var isPatient = user.IsInRole(nameof(UserRole.Patient));
        if (!isStaff && !isPatient)
            return false;

        // Patient: lectura permitida aunque la suscripción haya vencido.
        if (!isStaff && (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)))
            return false;

        return !await gate.IsTenantActiveAsync(tenantId.Value);
    }
}

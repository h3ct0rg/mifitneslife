using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.Dashboard;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/[controller]")]
// D2: solo staff del tenant. Patient y SuperAdmin reciben 403.
[Authorize(Roles = nameof(UserRole.Admin) + "," + nameof(UserRole.Nutritionist) + "," + nameof(UserRole.Trainer))]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("kpis")]
    [ProducesResponseType(typeof(DashboardKpisDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetKpis()
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var roleRaw = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role");
        if (!Enum.TryParse<UserRole>(roleRaw, out var role)
            || role is not (UserRole.Admin or UserRole.Nutritionist or UserRole.Trainer))
            return Forbid();

        return Ok(await _dashboardService.GetKpisAsync(tenantId.Value, userId, role));
    }

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out userId);
    }

    private Guid? GetTenantIdFromClaims()
    {
        var raw = User.FindFirstValue("tenant_id");
        return Guid.TryParse(raw, out var tenantId) ? tenantId : null;
    }
}

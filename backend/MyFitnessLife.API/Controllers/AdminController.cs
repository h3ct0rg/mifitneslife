using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = nameof(UserRole.SuperAdmin))]
public class AdminController : ControllerBase
{
    private readonly ISuperAdminService _superAdminService;

    public AdminController(ISuperAdminService superAdminService)
    {
        _superAdminService = superAdminService;
    }

    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(AdminDashboardDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Dashboard()
        => Ok(await _superAdminService.GetDashboardAsync());

    [HttpGet("tenants")]
    [ProducesResponseType(typeof(IEnumerable<TenantDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTenants()
        => Ok(await _superAdminService.GetTenantsAsync());

    [HttpPost("tenants")]
    [ProducesResponseType(typeof(TenantDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateTenant([FromBody] CreateTenantRequest request)
    {
        try
        {
            return Ok(await _superAdminService.CreateTenantAsync(request));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("tenants/{tenantId:guid}/activity")]
    [ProducesResponseType(typeof(IEnumerable<TenantActivityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTenantActivity(Guid tenantId)
        => Ok(await _superAdminService.GetTenantActivityAsync(tenantId));
}
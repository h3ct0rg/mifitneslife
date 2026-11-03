using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Exceptions;
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

    // ───────────── Tenants ─────────────

    [HttpGet("tenants")]
    [ProducesResponseType(typeof(IEnumerable<TenantDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTenants()
        => Ok(await _superAdminService.GetTenantsAsync());

    [HttpGet("tenants/{id:guid}")]
    [ProducesResponseType(typeof(TenantDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetTenant(Guid id)
        => Execute(async () => Ok(await _superAdminService.GetTenantAsync(id)));

    [HttpPost("tenants")]
    [ProducesResponseType(typeof(TenantDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateTenant([FromBody] CreateTenantRequest request)
        => Execute(async () =>
        {
            var tenant = await _superAdminService.CreateTenantAsync(request);
            return CreatedAtAction(nameof(GetTenant), new { id = tenant.Id }, tenant);
        });

    [HttpPut("tenants/{id:guid}")]
    [ProducesResponseType(typeof(TenantDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public Task<IActionResult> UpdateTenant(Guid id, [FromBody] UpdateTenantRequest request)
        => Execute(async () => Ok(await _superAdminService.UpdateTenantAsync(id, request)));

    [HttpGet("tenants/{tenantId:guid}/activity")]
    [ProducesResponseType(typeof(IEnumerable<TenantActivityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTenantActivity(Guid tenantId)
        => Ok(await _superAdminService.GetTenantActivityAsync(tenantId));

    // ───────────── Usuarios ─────────────

    [HttpGet("users")]
    [ProducesResponseType(typeof(PagedResult<AdminUserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public Task<IActionResult> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] Guid? tenantId = null,
        [FromQuery] string? role = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
        => Execute(async () => Ok(await _superAdminService.GetUsersAsync(search, tenantId, role, page, pageSize)));

    [HttpPost("users")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateUser([FromBody] CreateAdminUserRequest request)
        => Execute(async () =>
        {
            var user = await _superAdminService.CreateUserAsync(request);
            return StatusCode(StatusCodes.Status201Created, user);
        });

    [HttpPut("users/{id:guid}")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateAdminUserRequest request)
        => Execute(async () =>
        {
            if (!TryGetUserId(out var actorId))
                return Unauthorized();
            return Ok(await _superAdminService.UpdateUserAsync(actorId, id, request));
        });

    [HttpPut("users/{id:guid}/assignment")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public Task<IActionResult> AssignUser(Guid id, [FromBody] AssignUserRequest request)
        => Execute(async () =>
        {
            if (!TryGetUserId(out var actorId))
                return Unauthorized();
            return Ok(await _superAdminService.AssignUserAsync(actorId, id, request));
        });

    // ───────────── Eliminación ─────────────

    [HttpGet("tenants/{id:guid}/delete-impact")]
    [ProducesResponseType(typeof(TenantDeleteImpactDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetTenantDeleteImpact(Guid id)
        => Execute(async () => Ok(await _superAdminService.GetTenantDeleteImpactAsync(id)));

    [HttpDelete("tenants/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public Task<IActionResult> DeleteTenant(Guid id)
        => Execute(async () =>
        {
            if (!TryGetUserId(out var actorId))
                return Unauthorized();
            await _superAdminService.DeleteTenantAsync(actorId, id);
            return NoContent();
        });

    [HttpGet("users/{id:guid}/delete-impact")]
    [ProducesResponseType(typeof(UserDeleteImpactDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetUserDeleteImpact(Guid id)
        => Execute(async () => Ok(await _superAdminService.GetUserDeleteImpactAsync(id)));

    [HttpDelete("users/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public Task<IActionResult> DeleteUser(Guid id)
        => Execute(async () =>
        {
            if (!TryGetUserId(out var actorId))
                return Unauthorized();
            await _superAdminService.DeleteUserAsync(actorId, id);
            return NoContent();
        });

    // ───────────── Helpers ─────────────

    private async Task<IActionResult> Execute(Func<Task<IActionResult>> action)
    {
        try
        {
            return await action();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out userId);
    }
}

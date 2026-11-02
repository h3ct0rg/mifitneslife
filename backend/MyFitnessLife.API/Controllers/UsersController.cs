using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.Users;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserManagementService _userManagementService;

    public UsersController(IUserManagementService userManagementService)
    {
        _userManagementService = userManagementService;
    }

    [HttpGet("me")]
    [ProducesResponseType(typeof(MyFitnessLife.Application.DTOs.Auth.UserDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Me()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();
        return Ok(await _userManagementService.GetUserByIdAsync(userId));
    }

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<UserListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTenantUsers()
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null)
            return Forbid();
        return Ok(await _userManagementService.GetTenantUsersAsync(tenantId.Value));
    }

    [HttpPost("invite")]
    [ProducesResponseType(typeof(InviteUserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Invite([FromBody] InviteUserRequest request)
    {
        if (!TryGetUserId(out var inviterId))
            return Unauthorized();
        if (!IsTenantAdmin())
            return Forbid();

        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null)
            return Forbid();

        try
        {
            var result = await _userManagementService.InviteUserAsync(inviterId, tenantId.Value, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("invitations")]
    [ProducesResponseType(typeof(IEnumerable<InvitationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInvitations()
    {
        if (!IsTenantAdmin())
            return Forbid();
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null)
            return Forbid();

        return Ok(await _userManagementService.GetInvitationsAsync(tenantId.Value));
    }

    [HttpPost("invitations/{id:guid}/resend")]
    [ProducesResponseType(typeof(InvitationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResendInvitation(Guid id)
    {
        if (!IsTenantAdmin())
            return Forbid();
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null)
            return Forbid();

        try
        {
            return Ok(await _userManagementService.ResendInvitationAsync(tenantId.Value, id));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("invitations/{id:guid}/revoke")]
    [ProducesResponseType(typeof(InvitationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RevokeInvitation(Guid id)
    {
        if (!IsTenantAdmin())
            return Forbid();
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null)
            return Forbid();

        try
        {
            return Ok(await _userManagementService.RevokeInvitationAsync(tenantId.Value, id));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
    [HttpPost("accept-invitation")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> AcceptInvitation([FromBody] AcceptInvitationRequest request)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();
        try
        {
            await _userManagementService.AcceptInvitationAsync(userId, request);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("role")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> UpdateUserRole([FromBody] UpdateUserRoleRequest request)
    {
        if (!TryGetUserId(out var actorId))
            return Unauthorized();
        if (!IsTenantAdmin())
            return Forbid();

        try
        {
            await _userManagementService.UpdateUserRoleAsync(actorId, request);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("roles")]
    public IActionResult GetRoles()
    {
        var roles = Enum.GetValues<UserRole>()
            .Select(r => new { value = (int)r, name = r.ToString() });
        return Ok(roles);
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

    private bool IsTenantAdmin()
    {
        return User.IsInRole(nameof(UserRole.Admin))
            || User.IsInRole(nameof(UserRole.Nutritionist))
            || User.IsInRole(nameof(UserRole.Trainer));
    }
}
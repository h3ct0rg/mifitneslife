using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.Auth;
using MyFitnessLife.Application.DTOs.Users;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IUserManagementService _userManagementService;

    public AuthController(IAuthService authService, IUserManagementService userManagementService)
    {
        _authService = authService;
        _userManagementService = userManagementService;
    }

    /// <summary>1 membresía activa → AuthResponse; varias → MembershipSelectionResponse (sin tokens); 0 → 403.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(MembershipSelectionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(object), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
        => ToLoginResponse(await _authService.LoginAsync(request));

    [HttpPost("google-login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(MembershipSelectionResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
        => ToLoginResponse(await _authService.GoogleLoginAsync(request));

    [HttpPost("select-membership")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(object), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuthResponse>> SelectMembership([FromBody] SelectMembershipRequest request)
        => Ok(await _authService.SelectMembershipAsync(request));

    [Authorize]
    [HttpPost("switch-membership")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuthResponse>> SwitchMembership([FromBody] SwitchMembershipRequest request)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();
        return Ok(await _authService.SwitchMembershipAsync(userId, GetMembershipId(), request));
    }

    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);
        return Ok(result);
    }

    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RefreshTokenAsync(request.RefreshToken);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (Guid.TryParse(userIdRaw, out var userId))
            await _authService.LogoutAsync(userId);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpGet("invitation/{token}")]
    [ProducesResponseType(typeof(InvitationInfoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInvitation(string token)
    {
        var result = await _userManagementService.GetInvitationInfoAsync(token);
        return Ok(result);
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserDto>> Me()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var user = await _authService.GetUserByIdAsync(userId, GetMembershipId());
            return Ok(user);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    private IActionResult ToLoginResponse(LoginResult result)
        => result.Auth is not null ? Ok(result.Auth) : Ok(result.Selection);

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out userId);
    }

    /// <summary>Claim membership_id (tokens anteriores a multi-rol no lo traen → null).</summary>
    private Guid? GetMembershipId()
        => Guid.TryParse(User.FindFirstValue("membership_id"), out var id) ? id : null;
}
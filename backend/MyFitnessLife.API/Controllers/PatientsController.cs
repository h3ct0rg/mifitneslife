using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.API.Authorization;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PatientsController : ControllerBase
{
    private const int MaxPageSize = 100;
    private readonly IPatientService _patientService;
    private readonly ICurrentUser _currentUser;

    public PatientsController(IPatientService patientService, ICurrentUser currentUser)
    {
        _patientService = patientService;
        _currentUser = currentUser;
    }

    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(PagedResult<PatientDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        return Ok(await _patientService.GetPagedAsync(tenantId.Value, search, page, pageSize));
    }

    [HttpGet("me")]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyProfile()
    {
        if (_currentUser.TenantId is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(_currentUser.Email))
            return Unauthorized();

        var patient = await _currentUser.GetOwnPatientAsync();
        if (patient is null)
            return NotFound(new { error = "No se encontró un perfil de paciente para este usuario." });

        return Ok(patient);
    }

    /// <summary>Staff: cualquier paciente del tenant. Patient: solo su propio perfil (otro → 403).</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        if (!await _currentUser.CanAccessPatientAsync(id))
            return Forbid();

        try
        {
            return Ok(await _patientService.GetByIdAsync(tenantId.Value, id));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(PatientCreatedDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreatePatientRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        if (!TryGetUserId(out var actorId))
            return Unauthorized();

        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var result = await _patientService.CreateAsync(tenantId.Value, actorId, request);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Envía (o reenvía) la invitación de acceso al paciente. Solo staff del tenant.</summary>
    [HttpPost("{id:guid}/invite")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(PatientInviteResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Invite(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        if (!TryGetUserId(out var actorId))
            return Unauthorized();

        try
        {
            return Ok(await _patientService.InviteAsync(tenantId.Value, actorId, id));
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

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePatientRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        try
        {
            return Ok(await _patientService.UpdateAsync(tenantId.Value, id, request));
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

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        try
        {
            await _patientService.DeleteAsync(tenantId.Value, id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out userId);
    }
}

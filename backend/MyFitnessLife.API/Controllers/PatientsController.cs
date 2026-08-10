using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    public PatientsController(IPatientService patientService)
    {
        _patientService = patientService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PatientDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
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
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        var email = User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue("email");
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized();

        var patient = await _patientService.GetByEmailAsync(tenantId.Value, email);
        if (patient is null)
            return NotFound(new { error = "No se encontró un perfil de paciente para este usuario." });

        return Ok(patient);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
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
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreatePatientRequest request)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var result = await _patientService.CreateAsync(tenantId.Value, request);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePatientRequest request)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
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
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
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

    private Guid? GetTenantIdFromClaims()
    {
        var raw = User.FindFirstValue("tenant_id");
        return Guid.TryParse(raw, out var tenantId) ? tenantId : null;
    }
}
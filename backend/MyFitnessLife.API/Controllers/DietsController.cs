using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.API.Authorization;
using MyFitnessLife.Application.DTOs.Diets;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/diets")]
[Authorize]
public class DietsController : ControllerBase
{
    private readonly IDietService _dietService;
    private readonly ICurrentUser _currentUser;

    public DietsController(IDietService dietService, ICurrentUser currentUser)
    {
        _dietService = dietService;
        _currentUser = currentUser;
    }

    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(PagedResult<DietDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        return Ok(await _dietService.GetPagedAsync(tenantId.Value, search, page, pageSize));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(DietDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        try
        {
            return Ok(await _dietService.GetByIdAsync(tenantId.Value, id));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>Dieta asignada. Staff: cualquier paciente del tenant. Patient: solo la propia.</summary>
    [HttpGet("patient/{patientId:guid}")]
    [ProducesResponseType(typeof(DietDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByPatient(Guid patientId)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        if (!await _currentUser.CanAccessPatientAsync(patientId))
            return Forbid();

        var diet = await _dietService.GetByPatientAsync(tenantId.Value, patientId);
        if (diet is null)
            return Ok(new { assigned = false, diet = (DietDto?)null });

        return Ok(new { assigned = true, diet });
    }

    /// <summary>Historial de dietas. Staff: cualquier paciente del tenant. Patient: solo el propio.</summary>
    [HttpGet("patient/{patientId:guid}/history")]
    [ProducesResponseType(typeof(IEnumerable<PatientDietDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHistoryByPatient(Guid patientId)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        if (!await _currentUser.CanAccessPatientAsync(patientId))
            return Forbid();

        return Ok(await _dietService.GetHistoryByPatientAsync(tenantId.Value, patientId));
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(DietDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateDietRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        try
        {
            var result = await _dietService.CreateAsync(tenantId.Value, request);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(DietDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDietRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        try
        {
            return Ok(await _dietService.UpdateAsync(tenantId.Value, id, request));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
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
            await _dietService.DeleteAsync(tenantId.Value, id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPut("assign")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(DietDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignToPatient([FromBody] AssignDietRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        try
        {
            await _dietService.AssignToPatientAsync(tenantId.Value, request.PatientId, request.DietId);
            var assigned = await _dietService.GetByPatientAsync(tenantId.Value, request.PatientId);
            return Ok(assigned);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.Measurements;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/patients/{patientId:guid}/measurements")]
[Authorize]
public class MeasurementsController : ControllerBase
{
    private const int MaxPageSize = 100;
    private readonly IMeasurementService _measurementService;

    public MeasurementsController(IMeasurementService measurementService)
    {
        _measurementService = measurementService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<MeasurementDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByPatient(
        Guid patientId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        try
        {
            return Ok(await _measurementService.GetByPatientAsync(tenantId.Value, patientId, page, pageSize));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(MeasurementDashboardDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboard(Guid patientId)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        try
        {
            return Ok(await _measurementService.GetDashboardAsync(tenantId.Value, patientId));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MeasurementDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid patientId, Guid id)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        try
        {
            return Ok(await _measurementService.GetByIdAsync(tenantId.Value, patientId, id));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(MeasurementDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(Guid patientId, [FromBody] CreateMeasurementRequest request)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var result = await _measurementService.CreateAsync(tenantId.Value, patientId, request);
            return CreatedAtAction(nameof(GetById), new { patientId, id = result.Id }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(MeasurementDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid patientId, Guid id, [FromBody] UpdateMeasurementRequest request)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        try
        {
            return Ok(await _measurementService.UpdateAsync(tenantId.Value, patientId, id, request));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid patientId, Guid id)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        try
        {
            await _measurementService.DeleteAsync(tenantId.Value, patientId, id);
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
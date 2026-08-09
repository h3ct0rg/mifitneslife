using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.Appointments;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/appointments")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;

    public AppointmentsController(IAppointmentService appointmentService)
    {
        _appointmentService = appointmentService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<AppointmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByRange([FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        return Ok(await _appointmentService.GetByRangeAsync(tenantId.Value, from, to));
    }

    [HttpGet("professionals")]
    [ProducesResponseType(typeof(IEnumerable<ProfessionalDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProfessionals()
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        return Ok(await _appointmentService.GetProfessionalsAsync(tenantId.Value));
    }

    [HttpPost]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateAppointmentRequest request)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var result = await _appointmentService.CreateAsync(tenantId.Value, request);
            return CreatedAtAction(nameof(GetByRange), new { from = result.StartAt.Date, to = result.StartAt.Date.AddDays(1) }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAppointmentRequest request)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        try
        {
            return Ok(await _appointmentService.UpdateAsync(tenantId.Value, id, request));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
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
            await _appointmentService.DeleteAsync(tenantId.Value, id);
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
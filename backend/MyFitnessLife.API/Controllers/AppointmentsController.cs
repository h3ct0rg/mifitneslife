using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.API.Authorization;
using MyFitnessLife.Application.DTOs.Appointments;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/appointments")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;
    private readonly ICurrentUser _currentUser;

    public AppointmentsController(IAppointmentService appointmentService, ICurrentUser currentUser)
    {
        _appointmentService = appointmentService;
        _currentUser = currentUser;
    }

    /// <summary>Staff: todas las citas del tenant en el rango. Patient: solo sus propias citas.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<AppointmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByRange([FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        if (_currentUser.IsStaff)
            return Ok(await _appointmentService.GetByRangeAsync(tenantId.Value, from, to));

        if (!_currentUser.IsPatient)
            return Forbid();

        var ownPatientId = await _currentUser.GetOwnPatientIdAsync();
        if (ownPatientId is null)
            return Ok(Array.Empty<AppointmentDto>());

        var all = await _appointmentService.GetByRangeAsync(tenantId.Value, from, to);
        return Ok(all.Where(a => a.PatientId == ownPatientId.Value).ToList());
    }

    [HttpGet("professionals")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(IEnumerable<ProfessionalDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProfessionals()
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        return Ok(await _appointmentService.GetProfessionalsAsync(tenantId.Value));
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateAppointmentRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
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
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAppointmentRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
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
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
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
}

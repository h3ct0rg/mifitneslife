using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.WorkoutPlans;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/workout-plans")]
[Authorize]
public class WorkoutPlansController : ControllerBase
{
    private readonly IWorkoutPlanService _workoutPlanService;

    public WorkoutPlansController(IWorkoutPlanService workoutPlanService)
    {
        _workoutPlanService = workoutPlanService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<WorkoutPlanDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        return Ok(await _workoutPlanService.GetByTenantAsync(tenantId.Value));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(WorkoutPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        try
        {
            return Ok(await _workoutPlanService.GetByIdAsync(tenantId.Value, id));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpGet("patient/{patientId:guid}")]
    [ProducesResponseType(typeof(WorkoutPlanDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByPatient(Guid patientId)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        var plan = await _workoutPlanService.GetByPatientAsync(tenantId.Value, patientId);
        if (plan is null)
            return Ok(new { assigned = false, plan = (WorkoutPlanDto?)null });

        return Ok(new { assigned = true, plan });
    }

    [HttpPost]
    [ProducesResponseType(typeof(WorkoutPlanDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateWorkoutPlanRequest request)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        try
        {
            var result = await _workoutPlanService.CreateAsync(tenantId.Value, request);
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
    [ProducesResponseType(typeof(WorkoutPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWorkoutPlanRequest request)
    {
        var tenantId = GetTenantIdFromClaims();
        if (tenantId is null || tenantId == Guid.Empty)
            return Forbid();

        try
        {
            return Ok(await _workoutPlanService.UpdateAsync(tenantId.Value, id, request));
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
            await _workoutPlanService.DeleteAsync(tenantId.Value, id);
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
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.API.Authorization;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.DTOs.WorkoutPlans;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/workout-plans")]
[Authorize]
public class WorkoutPlansController : ControllerBase
{
    private readonly IWorkoutPlanService _workoutPlanService;
    private readonly ICurrentUser _currentUser;

    public WorkoutPlansController(IWorkoutPlanService workoutPlanService, ICurrentUser currentUser)
    {
        _workoutPlanService = workoutPlanService;
        _currentUser = currentUser;
    }

    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(PagedResult<WorkoutPlanDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        return Ok(await _workoutPlanService.GetPagedAsync(tenantId.Value, search, page, pageSize));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(WorkoutPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
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

    /// <summary>Rutina asignada. Staff: cualquier paciente del tenant. Patient: solo la propia.</summary>
    [HttpGet("patient/{patientId:guid}")]
    [ProducesResponseType(typeof(WorkoutPlanDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByPatient(Guid patientId)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        if (!await _currentUser.CanAccessPatientAsync(patientId))
            return Forbid();

        var plan = await _workoutPlanService.GetByPatientAsync(tenantId.Value, patientId);
        if (plan is null)
            return Ok(new { assigned = false, plan = (WorkoutPlanDto?)null });

        return Ok(new { assigned = true, plan });
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(WorkoutPlanDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateWorkoutPlanRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
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
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(WorkoutPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWorkoutPlanRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
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
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
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

    [HttpPut("assign")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(WorkoutPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignToPatient([FromBody] AssignWorkoutPlanRequest request)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        try
        {
            await _workoutPlanService.AssignToPatientAsync(tenantId.Value, request.PatientId, request.PlanId);
            var assigned = await _workoutPlanService.GetByPatientAsync(tenantId.Value, request.PatientId);
            return Ok(assigned);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}

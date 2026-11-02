using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.Exercises;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/exercises")]
[Authorize]
public class ExercisesController : ControllerBase
{
    private const int MaxPageSize = 200;
    private readonly IExerciseService _exerciseService;

    public ExercisesController(IExerciseService exerciseService)
    {
        _exerciseService = exerciseService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ExerciseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] string? equipment = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        return Ok(await _exerciseService.GetPagedAsync(search, category, equipment, page, pageSize));
    }

    [HttpGet("categories")]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories()
    {
        return Ok(await _exerciseService.GetCategoriesAsync());
    }

    [HttpGet("equipment")]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEquipment()
    {
        return Ok(await _exerciseService.GetEquipmentAsync());
    }

    [HttpPost("import-media")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<IActionResult> ImportMedia()
    {
        var imported = await _exerciseService.ImportMediaAsync();
        return Ok(new { imported });
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ExerciseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            return Ok(await _exerciseService.GetByIdAsync(id));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(ExerciseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateExerciseRequest request)
    {
        try
        {
            var result = await _exerciseService.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
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

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ExerciseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateExerciseRequest request)
    {
        try
        {
            return Ok(await _exerciseService.UpdateAsync(id, request));
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
        try
        {
            await _exerciseService.DeleteAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}
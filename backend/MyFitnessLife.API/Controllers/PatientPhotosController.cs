using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.API.Authorization;
using MyFitnessLife.Application.DTOs.PatientPhotos;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

/// <summary>Listado: staff del tenant o el propio paciente. Alta/baja: solo staff.</summary>
[ApiController]
[Route("api/patients/{patientId:guid}/photos")]
[Authorize]
public class PatientPhotosController : ControllerBase
{
    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif" };

    private readonly IPatientPhotoService _photoService;
    private readonly IMinioService _minioService;
    private readonly ICurrentUser _currentUser;

    public PatientPhotosController(IPatientPhotoService photoService, IMinioService minioService, ICurrentUser currentUser)
    {
        _photoService = photoService;
        _minioService = minioService;
        _currentUser = currentUser;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PatientPhotoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByPatient(Guid patientId)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        if (!await _currentUser.CanAccessPatientAsync(patientId))
            return Forbid();

        try
        {
            return Ok(await _photoService.GetByPatientAsync(tenantId.Value, patientId));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(typeof(PatientPhotoDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [RequestSizeLimit(10_485_760)] // 10 MB
    public async Task<IActionResult> Create(Guid patientId)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        var file = Request.Form.Files.FirstOrDefault();
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Archivo vacío." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            return BadRequest(new { error = "Formato no permitido. Use jpg, png, webp o heic." });

        // Fecha de la foto: el front puede enviarla como form field "takenAt" (ISO 8601).
        var takenAt = DateTime.UtcNow;
        var rawTakenAt = Request.Form["takenAt"].ToString();
        if (!string.IsNullOrWhiteSpace(rawTakenAt)
            && DateTime.TryParse(rawTakenAt, null, System.Globalization.DateTimeStyles.RoundtripKind, out var parsed))
        {
            takenAt = parsed;
        }

        try
        {
            var fileName = $"{Guid.NewGuid():N}{ext}";
            await using var stream = file.OpenReadStream();
            await _minioService.UploadImageAsync(fileName, stream);

            var result = await _photoService.CreateAsync(tenantId.Value, patientId, fileName, takenAt);
            return CreatedAtAction(nameof(GetByPatient), new { patientId }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid patientId, Guid id)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId is null)
            return Forbid();

        try
        {
            await _photoService.DeleteAsync(tenantId.Value, patientId, id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}

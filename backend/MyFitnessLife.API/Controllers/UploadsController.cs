using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/uploads")]
[Authorize]
public class UploadsController : ControllerBase
{
    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };

    private readonly IMinioService _minioService;
    private readonly ILogger<UploadsController> _logger;

    public UploadsController(IMinioService minioService, ILogger<UploadsController> logger)
    {
        _minioService = minioService;
        _logger = logger;
    }

    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [RequestSizeLimit(5_242_880)] // 5 MB
    public async Task<IActionResult> Upload()
    {
        var file = Request.Form.Files.FirstOrDefault();
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Archivo vacío." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            return BadRequest(new { error = "Formato no permitido. Use jpg, png o webp." });

        var fileName = $"{Guid.NewGuid():N}{ext}";
        await using var stream = file.OpenReadStream();
        await _minioService.UploadImageAsync(fileName, stream);

        _logger.LogInformation("Archivo subido a Minio: {File}", fileName);
        return Ok(new { fileName });
    }

    [HttpGet("{fileName}")]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || Path.GetFileName(fileName) != fileName)
            return BadRequest(new { error = "Nombre de archivo inválido." });

        try
        {
            var (stream, contentType) = await _minioService.GetImageAsync(fileName);
            return File(stream, contentType);
        }
        catch (Exception)
        {
            return NotFound(new { error = "Imagen no encontrada." });
        }
    }

    [HttpDelete("{fileName}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || Path.GetFileName(fileName) != fileName)
            return BadRequest(new { error = "Nombre de archivo inválido." });

        await _minioService.DeleteImageAsync(fileName);
        return NoContent();
    }
}
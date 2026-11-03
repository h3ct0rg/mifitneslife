using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using MyFitnessLife.API.Authorization;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Constants;

namespace MyFitnessLife.API.Controllers;

[ApiController]
[Route("api/uploads")]
[Authorize]
public class UploadsController : ControllerBase
{
    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };

    private readonly IMinioService _minioService;
    private readonly ILogger<UploadsController> _logger;
    private readonly MinioSettings _minioSettings;
    private readonly ICurrentUser _currentUser;
    private readonly IPatientPhotoService _photoService;

    public UploadsController(
        IMinioService minioService,
        ILogger<UploadsController> logger,
        IOptions<MinioSettings> minioSettings,
        ICurrentUser currentUser,
        IPatientPhotoService photoService)
    {
        _minioService = minioService;
        _logger = logger;
        _minioSettings = minioSettings.Value;
        _currentUser = currentUser;
        _photoService = photoService;

        _logger.LogInformation(
            "MinioSettings inicializado: Endpoint={Endpoint}, UseSSL={UseSSL}, BucketName={BucketName}, ImageExerciseBucket={ImageExerciseBucket}, VideoExerciseBucket={VideoExerciseBucket}, AccessKeySet={AccessKeySet}, SecretKeySet={SecretKeySet}",
            _minioSettings.Endpoint,
            _minioSettings.UseSSL,
            _minioSettings.BucketName,
            _minioSettings.ImageExerciseBucket,
            _minioSettings.VideoExerciseBucket,
            !string.IsNullOrEmpty(_minioSettings.AccessKey),
            !string.IsNullOrEmpty(_minioSettings.SecretKey));
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
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

        // Staff del tenant: sin cambios. Patient: solo su foto de perfil o sus fotos de progreso. Resto → 403.
        if (!_currentUser.IsStaff && !await IsOwnPatientFileAsync(fileName))
            return Forbid();

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

    [HttpGet("exercise-image/{*fileName}")]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetExerciseImage(string fileName)
    {
        // Media del catálogo global: staff o paciente del tenant (la rutina del paciente la muestra).
        if (!_currentUser.IsStaff && !_currentUser.IsPatient)
            return Forbid();

        fileName = NormalizePath(fileName);
        if (string.IsNullOrWhiteSpace(fileName) || !IsSafeExercisePath(fileName))
            return BadRequest(new { error = "Nombre de archivo inválido." });

        var bucket = (_minioSettings.ImageExerciseBucket ?? _minioSettings.BucketName).ToLowerInvariant();
        try
        {
            var (stream, contentType) = await _minioService.GetFileAsync(bucket, fileName);
            SetLongCacheHeaders();
            return File(stream, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener imagen de ejercicio. Bucket={Bucket}, FileName={FileName}", bucket, fileName);
            return NotFound(new { error = "Imagen no encontrada." });
        }
    }

    [HttpGet("exercise-video/{*fileName}")]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetExerciseVideo(string fileName)
    {
        if (!_currentUser.IsStaff && !_currentUser.IsPatient)
            return Forbid();

        fileName = NormalizePath(fileName);
        if (string.IsNullOrWhiteSpace(fileName) || !IsSafeExercisePath(fileName))
            return BadRequest(new { error = "Nombre de archivo inválido." });

        var bucket = (_minioSettings.VideoExerciseBucket ?? _minioSettings.BucketName).ToLowerInvariant();
        try
        {
            var (stream, contentType) = await _minioService.GetFileAsync(bucket, fileName);
            SetLongCacheHeaders();
            return File(stream, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener video de ejercicio. Bucket={Bucket}, FileName={FileName}", bucket, fileName);
            return NotFound(new { error = "Video no encontrado." });
        }
    }

    private void SetLongCacheHeaders()
    {
        // Los nombres de archivo de ejercicios son inmutables (mediaId), se cachean por mucho tiempo.
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        Response.Headers.Expires = DateTime.UtcNow.AddDays(365).ToString("R");
    }

    private static string NormalizePath(string path)
        => string.IsNullOrWhiteSpace(path) ? string.Empty : Uri.UnescapeDataString(path);

    private static bool IsSafeExercisePath(string path)
    {
        // Permitir rutas como "exercises/0001-2gPfomN.gif"
        if (!path.StartsWith("exercises/", StringComparison.OrdinalIgnoreCase))
            return false;
        if (path.Contains("..") || path.Contains("//") || path.Contains('\\'))
            return false;
        var fileName = path.Substring("exercises/".Length);
        return !string.IsNullOrWhiteSpace(fileName) && Path.GetFileName(fileName) == fileName;
    }

    private async Task<bool> IsOwnPatientFileAsync(string fileName)
    {
        if (!_currentUser.IsPatient || _currentUser.TenantId is not { } tenantId)
            return false;

        var own = await _currentUser.GetOwnPatientAsync();
        if (own is null)
            return false;

        if (string.Equals(own.ProfilePhotoUrl, fileName, StringComparison.Ordinal))
            return true;

        var photos = await _photoService.GetByPatientAsync(tenantId, own.Id);
        return photos.Any(p => string.Equals(p.FileName, fileName, StringComparison.Ordinal));
    }

    [HttpDelete("{fileName}")]
    [Authorize(Policy = AuthPolicies.StaffOnly)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || Path.GetFileName(fileName) != fileName)
            return BadRequest(new { error = "Nombre de archivo inválido." });

        await _minioService.DeleteImageAsync(fileName);
        return NoContent();
    }
}
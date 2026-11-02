using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyFitnessLife.Application.DTOs.Exercises;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Constants;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class ExerciseService : IExerciseService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMinioService _minioService;
    private readonly MinioSettings _minioSettings;
    private readonly ExerciseDatasetOptions _datasetOptions;
    private readonly ILogger<ExerciseService> _logger;

    public ExerciseService(
        IUnitOfWork unitOfWork,
        IMinioService minioService,
        IOptions<MinioSettings> minioSettings,
        IOptions<ExerciseDatasetOptions> datasetOptions,
        ILogger<ExerciseService> logger)
    {
        _unitOfWork = unitOfWork;
        _minioService = minioService;
        _minioSettings = minioSettings.Value;
        _datasetOptions = datasetOptions.Value;
        _logger = logger;
    }

    public async Task<int> ImportMediaAsync()
    {
        var exercises = (await _unitOfWork.Exercises.GetPagedAsync(pageSize: 2000))
            .Where(e => e.MediaId is not null && e.MediaId != string.Empty)
            .ToList();

        if (exercises.Count == 0)
        {
            _logger.LogWarning("[ExerciseMedia] Sin ejercicios para importar.");
            return 0;
        }

        var imagesBucket = (_minioSettings.ImageExerciseBucket ?? _minioSettings.BucketName).ToLowerInvariant();
        var videosBucket = (_minioSettings.VideoExerciseBucket ?? _minioSettings.BucketName).ToLowerInvariant();
        var datasetRoot = _datasetOptions.BasePath?.TrimEnd('\\', '/');

        _logger.LogInformation(
            "[ExerciseMedia] Importando {Count} ejercicios. imagesBucket={Images} videosBucket={Videos} datasetRoot={Root}",
            exercises.Count, imagesBucket, videosBucket, datasetRoot ?? "<vacío>");

        var imported = 0;

        foreach (var exercise in exercises)
        {
            var updated = false;

            // Imagen (archivo local: <dataset>/images/<mediaId>.jpg)
            if (exercise.ImageUrl is not null && exercise.ImageUrl.StartsWith("images/", StringComparison.OrdinalIgnoreCase))
            {
                var fileName = Path.GetFileName(exercise.ImageUrl);
                var localPath = datasetRoot is null ? null : Path.Combine(datasetRoot, "images", fileName);
                if (localPath is not null && File.Exists(localPath))
                {
                    if (await TryUploadLocalAsync(localPath, imagesBucket, $"exercises/{fileName}"))
                    {
                        exercise.ImageUrl = $"exercises/{fileName}";
                        updated = true;
                    }
                }
            }

            // GIF (archivo local: <dataset>/videos/<mediaId>.gif)
            if (exercise.GifUrl is not null && exercise.GifUrl.StartsWith("videos/", StringComparison.OrdinalIgnoreCase))
            {
                var fileName = Path.GetFileName(exercise.GifUrl);
                var localPath = datasetRoot is null ? null : Path.Combine(datasetRoot, "videos", fileName);
                if (localPath is not null && File.Exists(localPath))
                {
                    if (await TryUploadLocalAsync(localPath, videosBucket, $"exercises/{fileName}"))
                    {
                        exercise.GifUrl = $"exercises/{fileName}";
                        updated = true;
                    }
                }
            }

            if (updated)
            {
                exercise.UpdatedAt = DateTime.UtcNow;
                await _unitOfWork.Exercises.UpdateAsync(exercise);
                imported++;
            }
        }

        if (imported > 0)
            await _unitOfWork.SaveChangesAsync();

        return imported;
    }

    private async Task<bool> TryUploadLocalAsync(string localPath, string bucket, string objectName)
    {
        try
        {
            var contentType = GetContentType(localPath);
            await using var stream = File.OpenRead(localPath);
            await _minioService.UploadFileAsync(bucket, objectName, stream, contentType);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string GetContentType(string filePath)
    {
        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }

    public async Task<PagedResult<ExerciseDto>> GetPagedAsync(
        string? search = null,
        string? category = null,
        string? equipment = null,
        int page = 1,
        int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var items = await _unitOfWork.Exercises.GetPagedAsync(search, category, equipment, page, pageSize);
        var total = await _unitOfWork.Exercises.CountAsync(search, category, equipment);

        return new PagedResult<ExerciseDto>
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = items.Select(ToDto)
        };
    }

    public async Task<IEnumerable<string>> GetCategoriesAsync()
        => await _unitOfWork.Exercises.GetCategoriesAsync();

    public async Task<IEnumerable<string>> GetEquipmentAsync()
        => await _unitOfWork.Exercises.GetEquipmentAsync();

    public async Task<ExerciseDto> GetByIdAsync(Guid id)
    {
        var exercise = await GetExerciseAsync(id);
        return ToDto(exercise);
    }

    public async Task<ExerciseDto> CreateAsync(CreateExerciseRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("El nombre es obligatorio.", nameof(request.Name));

        var name = request.Name.Trim();
        var existing = await _unitOfWork.Exercises.GetByNameAsync(name);
        if (existing is not null)
            throw new InvalidOperationException("Ya existe un ejercicio con ese nombre.");

        var exercise = new Exercise
        {
            Name = name,
            Category = request.Category?.Trim() ?? string.Empty,
            BodyPart = request.BodyPart?.Trim() ?? string.Empty,
            Equipment = request.Equipment?.Trim() ?? string.Empty,
            Target = request.Target?.Trim(),
            MuscleGroup = request.MuscleGroup?.Trim(),
            SecondaryMuscles = request.SecondaryMuscles,
            Instructions = request.Instructions,
            ImageUrl = request.ImageUrl,
            GifUrl = request.GifUrl,
            MediaId = request.MediaId
        };

        await _unitOfWork.Exercises.AddAsync(exercise);
        await _unitOfWork.SaveChangesAsync();

        return ToDto(exercise);
    }

    public async Task<ExerciseDto> UpdateAsync(Guid id, UpdateExerciseRequest request)
    {
        var exercise = await GetExerciseAsync(id);

        var name = request.Name.Trim();
        var existing = await _unitOfWork.Exercises.GetByNameAsync(name);
        if (existing is not null && existing.Id != id)
            throw new InvalidOperationException("Ya existe un ejercicio con ese nombre.");

        exercise.Name = name;
        exercise.Category = request.Category?.Trim() ?? string.Empty;
        exercise.BodyPart = request.BodyPart?.Trim() ?? string.Empty;
        exercise.Equipment = request.Equipment?.Trim() ?? string.Empty;
        exercise.Target = request.Target?.Trim();
        exercise.MuscleGroup = request.MuscleGroup?.Trim();
        exercise.SecondaryMuscles = request.SecondaryMuscles;
        exercise.Instructions = request.Instructions;
        exercise.ImageUrl = request.ImageUrl;
        exercise.GifUrl = request.GifUrl;
        exercise.MediaId = request.MediaId;
        exercise.Status = Enum.TryParse<UserStatus>(request.Status, true, out var status) ? status : UserStatus.Active;
        exercise.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Exercises.UpdateAsync(exercise);
        await _unitOfWork.SaveChangesAsync();

        return ToDto(exercise);
    }

    public async Task DeleteAsync(Guid id)
    {
        var exercise = await GetExerciseAsync(id);
        await _unitOfWork.Exercises.DeleteAsync(exercise);
        await _unitOfWork.SaveChangesAsync();
    }

    private async Task<Exercise> GetExerciseAsync(Guid id)
    {
        var exercise = await _unitOfWork.Exercises.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Ejercicio no encontrado.");
        return exercise;
    }

    private static ExerciseDto ToDto(Exercise e)
        => new()
        {
            Id = e.Id,
            Name = e.Name,
            Category = e.Category,
            BodyPart = e.BodyPart,
            Equipment = e.Equipment,
            Target = e.Target,
            MuscleGroup = e.MuscleGroup,
            SecondaryMuscles = e.SecondaryMuscles,
            Instructions = e.Instructions,
            ImageUrl = e.ImageUrl,
            GifUrl = e.GifUrl,
            MediaId = e.MediaId,
            Status = e.Status.ToString()
        };
}
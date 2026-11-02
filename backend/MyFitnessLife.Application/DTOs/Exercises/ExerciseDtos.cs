namespace MyFitnessLife.Application.DTOs.Exercises;

public class CreateExerciseRequest
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string BodyPart { get; set; } = string.Empty;
    public string Equipment { get; set; } = string.Empty;
    public string? Target { get; set; }
    public string? MuscleGroup { get; set; }
    public string? SecondaryMuscles { get; set; }
    public string? Instructions { get; set; }
    public string? ImageUrl { get; set; }
    public string? GifUrl { get; set; }
    public string? MediaId { get; set; }
}

public class UpdateExerciseRequest : CreateExerciseRequest
{
    public string Status { get; set; } = "Active";
}

public class ExerciseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string BodyPart { get; set; } = string.Empty;
    public string Equipment { get; set; } = string.Empty;
    public string? Target { get; set; }
    public string? MuscleGroup { get; set; }
    public string? SecondaryMuscles { get; set; }
    public string? Instructions { get; set; }
    public string? ImageUrl { get; set; }
    public string? GifUrl { get; set; }
    public string? MediaId { get; set; }
    public string Status { get; set; } = "Active";
}
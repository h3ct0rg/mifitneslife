namespace MyFitnessLife.Application.DTOs.WorkoutPlans;

public class AssignWorkoutPlanRequest
{
    public Guid PatientId { get; set; }
    public Guid? PlanId { get; set; }
}

public class WorkoutExerciseRequest
{
    public Guid ExerciseId { get; set; }
    public int? Sets { get; set; }
    public string? Reps { get; set; }
    public int? RestSeconds { get; set; }
    public string? Notes { get; set; }
}

public class WorkoutDayRequest
{
    public string DayName { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public List<WorkoutExerciseRequest> Exercises { get; set; } = [];
}

public class CreateWorkoutPlanRequest
{
    public string Name { get; set; } = string.Empty;
    public Guid? PatientId { get; set; }
    public string? Objective { get; set; }
    public string? Observations { get; set; }
    public List<WorkoutDayRequest> Days { get; set; } = [];
}

public class UpdateWorkoutPlanRequest : CreateWorkoutPlanRequest
{
    public string Status { get; set; } = "Active";
}

public class WorkoutExerciseDto
{
    public Guid Id { get; set; }
    public Guid ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public string ExerciseCategory { get; set; } = string.Empty;
    public string ExerciseEquipment { get; set; } = string.Empty;
    public string? ExerciseGifUrl { get; set; }
    public int? Sets { get; set; }
    public string? Reps { get; set; }
    public int? RestSeconds { get; set; }
    public string? Notes { get; set; }
    public int SortOrder { get; set; }
}

public class WorkoutDayDto
{
    public Guid Id { get; set; }
    public string DayName { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public int SortOrder { get; set; }
    public List<WorkoutExerciseDto> Exercises { get; set; } = [];
}

public class WorkoutPlanDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? PatientId { get; set; }
    public string? PatientName { get; set; }
    public string? Objective { get; set; }
    public string? Observations { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
    public List<WorkoutDayDto> Days { get; set; } = [];
    public int TotalExercises { get; set; }
}
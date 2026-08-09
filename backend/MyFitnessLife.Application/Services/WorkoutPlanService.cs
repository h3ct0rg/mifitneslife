using MyFitnessLife.Application.DTOs.WorkoutPlans;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class WorkoutPlanService : IWorkoutPlanService
{
    private readonly IUnitOfWork _unitOfWork;

    public WorkoutPlanService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<WorkoutPlanDto>> GetByTenantAsync(Guid tenantId)
    {
        var plans = await _unitOfWork.WorkoutPlans.GetByTenantAsync(tenantId);
        var result = new List<WorkoutPlanDto>();
        foreach (var plan in plans)
        {
            var full = await _unitOfWork.WorkoutPlans.GetByIdAsync(plan.Id);
            if (full is not null)
                result.Add(ToDto(full));
        }
        return result;
    }

    public async Task<WorkoutPlanDto> GetByIdAsync(Guid tenantId, Guid id)
    {
        var plan = await GetPlanAsync(tenantId, id);
        return ToDto(plan);
    }

    public async Task<WorkoutPlanDto?> GetByPatientAsync(Guid tenantId, Guid patientId)
    {
        var plan = await _unitOfWork.WorkoutPlans.GetByPatientAsync(patientId);
        if (plan is null)
            return null;
        if (plan.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese plan.");
        return ToDto(plan);
    }

    public async Task<WorkoutPlanDto> CreateAsync(Guid tenantId, CreateWorkoutPlanRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("El nombre del plan es obligatorio.", nameof(request.Name));

        if (request.PatientId.HasValue)
            await EnsurePatientAsync(tenantId, request.PatientId.Value);

        var plan = new WorkoutPlan
        {
            TenantId = tenantId,
            Name = request.Name.Trim(),
            PatientId = request.PatientId,
            Objective = request.Objective?.Trim(),
            Observations = request.Observations
        };

        foreach (var day in BuildDays(tenantId, request.Days))
            plan.Days.Add(day);

        await _unitOfWork.WorkoutPlans.AddAsync(plan);
        await _unitOfWork.SaveChangesAsync();

        return await GetByIdAsync(tenantId, plan.Id);
    }

    public async Task<WorkoutPlanDto> UpdateAsync(Guid tenantId, Guid id, UpdateWorkoutPlanRequest request)
    {
        var plan = await GetPlanAsync(tenantId, id);

        if (request.PatientId.HasValue)
            await EnsurePatientAsync(tenantId, request.PatientId.Value);

        plan.Name = request.Name.Trim();
        plan.PatientId = request.PatientId;
        plan.Objective = request.Objective?.Trim();
        plan.Observations = request.Observations;
        plan.Status = Enum.TryParse<UserStatus>(request.Status, true, out var status) ? status : UserStatus.Active;
        plan.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.WorkoutPlans.UpdateAsync(plan);
        await _unitOfWork.WorkoutPlans.ReplaceDaysAsync(plan, BuildDays(tenantId, request.Days));
        await _unitOfWork.SaveChangesAsync();

        return await GetByIdAsync(tenantId, plan.Id);
    }

    public async Task DeleteAsync(Guid tenantId, Guid id)
    {
        var plan = await GetPlanAsync(tenantId, id);
        await _unitOfWork.WorkoutPlans.DeleteAsync(plan);
        await _unitOfWork.SaveChangesAsync();
    }

    private List<WorkoutDay> BuildDays(Guid tenantId, List<WorkoutDayRequest> days)
    {
        var result = new List<WorkoutDay>();
        var dayOrder = 0;
        foreach (var dayRequest in days.Where(d => !string.IsNullOrWhiteSpace(d.DayName)))
        {
            var day = new WorkoutDay
            {
                TenantId = tenantId,
                DayName = dayRequest.DayName.Trim(),
                Notes = dayRequest.Notes,
                SortOrder = dayOrder++
            };

            var exOrder = 0;
            foreach (var exRequest in dayRequest.Exercises)
            {
                day.Exercises.Add(new WorkoutExercise
                {
                    TenantId = tenantId,
                    ExerciseId = exRequest.ExerciseId,
                    Sets = exRequest.Sets,
                    Reps = exRequest.Reps,
                    RestSeconds = exRequest.RestSeconds,
                    Notes = exRequest.Notes,
                    SortOrder = exOrder++
                });
            }

            result.Add(day);
        }
        return result;
    }

    private async Task EnsurePatientAsync(Guid tenantId, Guid patientId)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(patientId)
            ?? throw new KeyNotFoundException("Paciente no encontrado.");
        if (patient.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese paciente.");
    }

    private async Task<WorkoutPlan> GetPlanAsync(Guid tenantId, Guid id)
    {
        var plan = await _unitOfWork.WorkoutPlans.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Plan de entrenamiento no encontrado.");
        if (plan.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese plan.");
        return plan;
    }

    private static WorkoutPlanDto ToDto(WorkoutPlan plan)
    {
        var days = plan.Days.OrderBy(d => d.SortOrder).Select(ToDayDto).ToList();

        return new WorkoutPlanDto
        {
            Id = plan.Id,
            Name = plan.Name,
            PatientId = plan.PatientId,
            PatientName = plan.Patient?.FullName,
            Objective = plan.Objective,
            Observations = plan.Observations,
            Status = plan.Status.ToString(),
            CreatedAt = plan.CreatedAt,
            Days = days,
            TotalExercises = days.Sum(d => d.Exercises.Count)
        };
    }

    private static WorkoutDayDto ToDayDto(WorkoutDay day)
    {
        var exercises = day.Exercises.OrderBy(e => e.SortOrder).Select(e => new WorkoutExerciseDto
        {
            Id = e.Id,
            ExerciseId = e.ExerciseId,
            ExerciseName = e.Exercise?.Name ?? "Ejercicio",
            ExerciseCategory = e.Exercise?.Category ?? string.Empty,
            ExerciseEquipment = e.Exercise?.Equipment ?? string.Empty,
            ExerciseGifUrl = e.Exercise?.GifUrl,
            Sets = e.Sets,
            Reps = e.Reps,
            RestSeconds = e.RestSeconds,
            Notes = e.Notes,
            SortOrder = e.SortOrder
        }).ToList();

        return new WorkoutDayDto
        {
            Id = day.Id,
            DayName = day.DayName,
            Notes = day.Notes,
            SortOrder = day.SortOrder,
            Exercises = exercises
        };
    }
}
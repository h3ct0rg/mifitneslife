using MyFitnessLife.Application.DTOs.Diets;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class DietService : IDietService
{
    private readonly IUnitOfWork _unitOfWork;

    public DietService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<DietDto>> GetByTenantAsync(Guid tenantId)
    {
        var diets = await _unitOfWork.Diets.GetByTenantAsync(tenantId);
        var result = new List<DietDto>();

        foreach (var diet in diets)
        {
            var full = await _unitOfWork.Diets.GetByIdAsync(diet.Id);
            if (full is not null)
                result.Add(ToDto(full));
        }

        return result;
    }

    public async Task<PagedResult<DietDto>> GetPagedAsync(
        Guid tenantId,
        string? search = null,
        int page = 1,
        int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var items = await _unitOfWork.Diets.GetPagedAsync(tenantId, search, page, pageSize);
        var total = await _unitOfWork.Diets.CountAsync(tenantId, search);

        var dtos = new List<DietDto>();
        foreach (var item in items)
        {
            var full = await _unitOfWork.Diets.GetByIdAsync(item.Id);
            if (full is not null)
                dtos.Add(ToDto(full));
        }

        return new PagedResult<DietDto>
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = dtos
        };
    }

    public async Task<DietDto> GetByIdAsync(Guid tenantId, Guid id)
    {
        var diet = await GetDietAsync(tenantId, id);
        return ToDto(diet);
    }

    public async Task<DietDto?> GetByPatientAsync(Guid tenantId, Guid patientId)
    {
        var active = await _unitOfWork.PatientDiets.GetActiveByPatientAsync(patientId);
        if (active is null || active.Diet is null)
            return null;

        var diet = active.Diet;
        if (diet.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a esa dieta.");

        // Cargar comidas y ítems completos
        var full = await _unitOfWork.Diets.GetByIdAsync(diet.Id);
        return full is null ? null : ToDto(full);
    }

    public async Task<IEnumerable<PatientDietDto>> GetHistoryByPatientAsync(Guid tenantId, Guid patientId)
    {
        await EnsurePatientAsync(tenantId, patientId);
        var history = await _unitOfWork.PatientDiets.GetHistoryByPatientAsync(patientId);

        return history
            .Where(pd => pd.Diet is null || pd.Diet.TenantId == tenantId)
            .Select(pd => new PatientDietDto
            {
                Id = pd.Id,
                DietId = pd.DietId,
                DietName = pd.Diet?.Name ?? "Dieta eliminada",
                Objective = pd.Diet?.Objective,
                AssignedAt = pd.AssignedAt,
                IsActive = pd.IsActive
            });
    }

    public async Task<DietDto> CreateAsync(Guid tenantId, CreateDietRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("El nombre de la dieta es obligatorio.", nameof(request.Name));

        if (request.PatientId.HasValue)
            await EnsurePatientAsync(tenantId, request.PatientId.Value);

        var diet = new Diet
        {
            TenantId = tenantId,
            Name = request.Name.Trim(),
            PatientId = request.PatientId,
            Objective = request.Objective?.Trim(),
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Observations = request.Observations,
            GoalCalories = request.GoalCalories,
            GoalProtein = request.GoalProtein,
            GoalCarbs = request.GoalCarbs,
            GoalFat = request.GoalFat,
            GoalFiber = request.GoalFiber,
        };

        foreach (var meal in BuildMeals(tenantId, request.Meals))
            diet.Meals.Add(meal);

        await _unitOfWork.Diets.AddAsync(diet);
        await _unitOfWork.SaveChangesAsync();

        return await GetByIdAsync(tenantId, diet.Id);
    }

    public async Task<DietDto> UpdateAsync(Guid tenantId, Guid id, UpdateDietRequest request)
    {
        var diet = await GetDietAsync(tenantId, id);

        if (request.PatientId.HasValue)
            await EnsurePatientAsync(tenantId, request.PatientId.Value);

        diet.Name = request.Name.Trim();
        diet.PatientId = request.PatientId;
        diet.Objective = request.Objective?.Trim();
        diet.StartDate = request.StartDate;
        diet.EndDate = request.EndDate;
        diet.Observations = request.Observations;
        diet.GoalCalories = request.GoalCalories;
        diet.GoalProtein = request.GoalProtein;
        diet.GoalCarbs = request.GoalCarbs;
        diet.GoalFat = request.GoalFat;
        diet.GoalFiber = request.GoalFiber;
        diet.Status = Enum.TryParse<UserStatus>(request.Status, true, out var status) ? status : UserStatus.Active;
        diet.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Diets.UpdateAsync(diet);
        await _unitOfWork.Diets.ReplaceMealsAsync(diet, BuildMeals(tenantId, request.Meals));
        await _unitOfWork.SaveChangesAsync();

        return await GetByIdAsync(tenantId, diet.Id);
    }

    public async Task DeleteAsync(Guid tenantId, Guid id)
    {
        var diet = await GetDietAsync(tenantId, id);
        await _unitOfWork.Diets.DeleteAsync(diet);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task AssignToPatientAsync(Guid tenantId, Guid patientId, Guid? dietId)
    {
        await EnsurePatientAsync(tenantId, patientId);

        // Desactivar la asignación activa actual (historial conserva las anteriores).
        var active = await _unitOfWork.PatientDiets.GetActiveByPatientAsync(patientId);
        if (active is not null)
        {
            active.IsActive = false;
            await _unitOfWork.PatientDiets.UpdateAsync(active);
        }

        if (dietId.HasValue)
        {
            var diet = await GetDietAsync(tenantId, dietId.Value);

            // Registrar la nueva asignación en el historial.
            await _unitOfWork.PatientDiets.AddAsync(new PatientDiet
            {
                TenantId = tenantId,
                PatientId = patientId,
                DietId = dietId.Value,
                AssignedAt = DateTime.UtcNow,
                IsActive = true
            });
        }

        await _unitOfWork.SaveChangesAsync();
    }

    private List<Meal> BuildMeals(Guid tenantId, List<MealRequest> meals)
    {
        var result = new List<Meal>();
        var order = 0;
        foreach (var mealRequest in meals.Where(m => !string.IsNullOrWhiteSpace(m.Name)))
        {
            var meal = new Meal
            {
                TenantId = tenantId,
                Name = mealRequest.Name.Trim(),
                ScheduledTime = mealRequest.ScheduledTime?.Trim(),
                Instructions = mealRequest.Instructions,
                SortOrder = order++
            };

            foreach (var itemRequest in mealRequest.Items.Where(i => i.Quantity > 0))
            {
                meal.Items.Add(new MealItem
                {
                    TenantId = tenantId,
                    FoodId = itemRequest.FoodId,
                    Quantity = itemRequest.Quantity,
                    Unit = string.IsNullOrWhiteSpace(itemRequest.Unit) ? "g" : itemRequest.Unit.Trim()
                });
            }

            result.Add(meal);
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

    private async Task<Diet> GetDietAsync(Guid tenantId, Guid id)
    {
        var diet = await _unitOfWork.Diets.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Dieta no encontrada.");
        if (diet.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a esa dieta.");
        return diet;
    }

    private static DietDto ToDto(Diet diet)
    {
        var meals = diet.Meals.OrderBy(m => m.SortOrder).Select(ToMealDto).ToList();

        return new DietDto
        {
            Id = diet.Id,
            Name = diet.Name,
            PatientId = diet.PatientId,
            PatientName = diet.Patient?.FullName,
            Objective = diet.Objective,
            StartDate = diet.StartDate,
            EndDate = diet.EndDate,
            Observations = diet.Observations,
            Status = diet.Status.ToString(),
            CreatedAt = diet.CreatedAt,
            GoalCalories = diet.GoalCalories,
            GoalProtein = diet.GoalProtein,
            GoalCarbs = diet.GoalCarbs,
            GoalFat = diet.GoalFat,
            GoalFiber = diet.GoalFiber,
            Meals = meals,
            Calories = meals.Sum(m => m.Calories),
            Protein = meals.Sum(m => m.Protein),
            Carbohydrates = meals.Sum(m => m.Carbohydrates),
            Fat = meals.Sum(m => m.Fat),
            Fiber = meals.Sum(m => m.Fiber),
            Sugar = meals.Sum(m => m.Sugar),
            Sodium = meals.Sum(m => m.Sodium),
            Potassium = meals.Sum(m => m.Potassium),
            Cholesterol = meals.Sum(m => m.Cholesterol),
            Iron = meals.Sum(m => m.Iron),
            Calcium = meals.Sum(m => m.Calcium),
        };
    }

    private static MealDto ToMealDto(Meal meal)
    {
        var items = meal.Items.Select(ToMealItemDto).ToList();

        return new MealDto
        {
            Id = meal.Id,
            Name = meal.Name,
            ScheduledTime = meal.ScheduledTime,
            Instructions = meal.Instructions,
            SortOrder = meal.SortOrder,
            Items = items,
            Calories = items.Sum(i => i.Calories),
            Protein = items.Sum(i => i.Protein),
            Carbohydrates = items.Sum(i => i.Carbohydrates),
            Fat = items.Sum(i => i.Fat),
            Fiber = items.Sum(i => i.Fiber),
            Sugar = items.Sum(i => i.Sugar),
            Sodium = items.Sum(i => i.Sodium),
            Potassium = items.Sum(i => i.Potassium),
            Cholesterol = items.Sum(i => i.Cholesterol),
            Iron = items.Sum(i => i.Iron),
            Calcium = items.Sum(i => i.Calcium),
        };
    }

    private static MealItemDto ToMealItemDto(MealItem item)
    {
        var food = item.Food;
        var baseQty = food?.DefaultQuantity > 0 ? food.DefaultQuantity : 100m;
        var factor = item.Quantity / baseQty;

        return new MealItemDto
        {
            Id = item.Id,
            FoodId = item.FoodId,
            FoodName = food?.Name ?? "Alimento",
            Quantity = item.Quantity,
            Unit = item.Unit,
            Calories = Round(food?.Calories * factor),
            Protein = Round(food?.Protein * factor),
            Carbohydrates = Round(food?.Carbohydrates * factor),
            Fat = Round(food?.Fat * factor),
            Fiber = Round(food?.Fiber * factor),
            Sugar = Round(food?.Sugar * factor),
            Sodium = Round(food?.Sodium * factor),
            Potassium = Round(food?.Potassium * factor),
            Cholesterol = Round(food?.Cholesterol * factor),
            Iron = Round(food?.Iron * factor),
            Calcium = Round(food?.Calcium * factor),
        };
    }

    private static decimal Round(decimal? value)
        => value.HasValue ? Math.Round(value.Value, 1) : 0;
}
namespace MyFitnessLife.Application.DTOs.Diets;

public class AssignDietRequest
{
    public Guid PatientId { get; set; }
    public Guid? DietId { get; set; }
}

public class PatientDietDto
{
    public Guid Id { get; set; }
    public Guid DietId { get; set; }
    public string DietName { get; set; } = string.Empty;
    public string? Objective { get; set; }
    public DateTime AssignedAt { get; set; }
    public bool IsActive { get; set; }
}

public class MealItemRequest
{
    public Guid FoodId { get; set; }
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "g";
}

public class MealRequest
{
    public string Name { get; set; } = string.Empty;
    public string? ScheduledTime { get; set; }
    public string? Instructions { get; set; }
    public List<MealItemRequest> Items { get; set; } = [];
}

public class CreateDietRequest
{
    public string Name { get; set; } = string.Empty;
    public Guid? PatientId { get; set; }
    public string? Objective { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Observations { get; set; }
    public decimal? GoalCalories { get; set; }
    public decimal? GoalProtein { get; set; }
    public decimal? GoalCarbs { get; set; }
    public decimal? GoalFat { get; set; }
    public decimal? GoalFiber { get; set; }
    public List<MealRequest> Meals { get; set; } = [];
}

public class UpdateDietRequest : CreateDietRequest
{
    public string Status { get; set; } = "Active";
}

public class MealItemDto
{
    public Guid Id { get; set; }
    public Guid FoodId { get; set; }
    public string FoodName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "g";

    public decimal Calories { get; set; }
    public decimal Protein { get; set; }
    public decimal Carbohydrates { get; set; }
    public decimal Fat { get; set; }
    public decimal Fiber { get; set; }
    public decimal Sugar { get; set; }
    public decimal Sodium { get; set; }
    public decimal Potassium { get; set; }
    public decimal Cholesterol { get; set; }
    public decimal Iron { get; set; }
    public decimal Calcium { get; set; }
}

public class MealDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ScheduledTime { get; set; }
    public string? Instructions { get; set; }
    public int SortOrder { get; set; }
    public List<MealItemDto> Items { get; set; } = [];

    public decimal Calories { get; set; }
    public decimal Protein { get; set; }
    public decimal Carbohydrates { get; set; }
    public decimal Fat { get; set; }
    public decimal Fiber { get; set; }
    public decimal Sugar { get; set; }
    public decimal Sodium { get; set; }
    public decimal Potassium { get; set; }
    public decimal Cholesterol { get; set; }
    public decimal Iron { get; set; }
    public decimal Calcium { get; set; }
}

public class DietDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? PatientId { get; set; }
    public string? PatientName { get; set; }
    public string? Objective { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Observations { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }

    public decimal? GoalCalories { get; set; }
    public decimal? GoalProtein { get; set; }
    public decimal? GoalCarbs { get; set; }
    public decimal? GoalFat { get; set; }
    public decimal? GoalFiber { get; set; }

    public List<MealDto> Meals { get; set; } = [];

    // Totales calculados por día
    public decimal Calories { get; set; }
    public decimal Protein { get; set; }
    public decimal Carbohydrates { get; set; }
    public decimal Fat { get; set; }
    public decimal Fiber { get; set; }
    public decimal Sugar { get; set; }
    public decimal Sodium { get; set; }
    public decimal Potassium { get; set; }
    public decimal Cholesterol { get; set; }
    public decimal Iron { get; set; }
    public decimal Calcium { get; set; }
}
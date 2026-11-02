namespace MyFitnessLife.Application.DTOs.Foods;

public class CreateFoodRequest
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Subcategory { get; set; }
    public string? Description { get; set; }
    public string Unit { get; set; } = "g";
    public decimal DefaultQuantity { get; set; } = 100;
    public string? Brand { get; set; }
    public string? Code { get; set; }

    public decimal Calories { get; set; }
    public decimal Protein { get; set; }
    public decimal Carbohydrates { get; set; }
    public decimal Fat { get; set; }
    public decimal Fiber { get; set; }
    public decimal Sugar { get; set; }
    public decimal Sodium { get; set; }
    public decimal Potassium { get; set; }
    public decimal Calcium { get; set; }
    public decimal Iron { get; set; }
    public decimal Cholesterol { get; set; }
}

public class UpdateFoodRequest : CreateFoodRequest
{
    public string Status { get; set; } = "Active";
}

public class FoodDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Subcategory { get; set; }
    public string? Description { get; set; }
    public string Unit { get; set; } = "g";
    public decimal DefaultQuantity { get; set; } = 100;
    public string? Brand { get; set; }
    public string? Code { get; set; }
    public string Status { get; set; } = "Active";

    public decimal Calories { get; set; }
    public decimal Protein { get; set; }
    public decimal Carbohydrates { get; set; }
    public decimal Fat { get; set; }
    public decimal Fiber { get; set; }
    public decimal Sugar { get; set; }
    public decimal Sodium { get; set; }
    public decimal Potassium { get; set; }
    public decimal Calcium { get; set; }
    public decimal Iron { get; set; }
    public decimal Cholesterol { get; set; }
}
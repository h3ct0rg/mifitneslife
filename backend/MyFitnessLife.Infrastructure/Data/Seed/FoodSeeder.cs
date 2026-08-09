using Microsoft.EntityFrameworkCore;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using System.Reflection;
using System.Text.Json;

namespace MyFitnessLife.Infrastructure.Data.Seed;

public static class FoodSeeder
{
    private sealed class SeedFood
    {
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal DefaultQuantity { get; set; } = 100;
        public string Unit { get; set; } = "g";
        public SeedNutrition? NutritionPer100g { get; set; }
        public SeedServing? CommonServing { get; set; }
    }

    private sealed class SeedNutrition
    {
        public decimal Calories { get; set; }
        public decimal Protein { get; set; }
        public decimal Carbohydrates { get; set; }
        public decimal Fat { get; set; }
        public decimal Fiber { get; set; }
        public SeedMicronutrients? Micronutrients { get; set; }
    }

    private sealed class SeedMicronutrients
    {
        public decimal Sugars { get; set; }
        public decimal Sodium { get; set; }
        public decimal Potassium { get; set; }
        public decimal Cholesterol { get; set; }
        public decimal Iron { get; set; }
        public decimal Calcium { get; set; }
    }

    private sealed class SeedServing
    {
        public decimal Quantity { get; set; }
        public string Unit { get; set; } = string.Empty;
        public decimal ApproximateWeightGrams { get; set; }
    }

    public static async Task SeedFoodsAsync(AppDbContext context)
    {
        var assembly = Assembly.GetExecutingAssembly();
        const string resourceName = "Infrastructure.Data.Seed.alimentos.json";

        await using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream is null)
            return;

        var foods = await JsonSerializer.DeserializeAsync<List<SeedFood>>(stream, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (foods is null || foods.Count == 0)
            return;

        var tenant = await context.Tenants.FirstOrDefaultAsync(t => t.Slug == "demo");
        if (tenant is null)
            return;

        var existing = await context.Foods
            .Where(f => f.TenantId == tenant.Id)
            .ToDictionaryAsync(f => f.Name);

        var now = DateTime.UtcNow;
        var changed = 0;

        foreach (var seed in foods)
        {
            if (string.IsNullOrWhiteSpace(seed.Name))
                continue;

            var food = existing.GetValueOrDefault(seed.Name);

            if (food is null)
            {
                food = new Food
                {
                    TenantId = tenant.Id,
                    Name = seed.Name,
                    Status = UserStatus.Active,
                    CreatedAt = now
                };
                context.Foods.Add(food);
            }

            food.Category = seed.Category;
            food.Unit = string.IsNullOrWhiteSpace(seed.Unit) ? "g" : seed.Unit;
            food.DefaultQuantity = seed.DefaultQuantity > 0 ? seed.DefaultQuantity : 100;
            food.Calories = seed.NutritionPer100g?.Calories ?? 0;
            food.Protein = seed.NutritionPer100g?.Protein ?? 0;
            food.Carbohydrates = seed.NutritionPer100g?.Carbohydrates ?? 0;
            food.Fat = seed.NutritionPer100g?.Fat ?? 0;
            food.Fiber = seed.NutritionPer100g?.Fiber ?? 0;
            food.Sugar = seed.NutritionPer100g?.Micronutrients?.Sugars ?? 0;
            food.Sodium = seed.NutritionPer100g?.Micronutrients?.Sodium ?? 0;
            food.Potassium = seed.NutritionPer100g?.Micronutrients?.Potassium ?? 0;
            food.Cholesterol = seed.NutritionPer100g?.Micronutrients?.Cholesterol ?? 0;
            food.Iron = seed.NutritionPer100g?.Micronutrients?.Iron ?? 0;
            food.Calcium = seed.NutritionPer100g?.Micronutrients?.Calcium ?? 0;
            food.UpdatedAt = now;

            changed++;
        }

        if (changed > 0)
            await context.SaveChangesAsync();
    }
}
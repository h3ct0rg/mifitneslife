using MyFitnessLife.Application.DTOs.Foods;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class FoodService : IFoodService
{
    private readonly IUnitOfWork _unitOfWork;

    public FoodService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<PagedResult<FoodDto>> GetByTenantAsync(
        Guid tenantId,
        string? search = null,
        string? category = null,
        int page = 1,
        int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var items = await _unitOfWork.Foods.GetByTenantAsync(tenantId, search, category, page, pageSize);
        var total = await _unitOfWork.Foods.CountByTenantAsync(tenantId, search, category);

        return new PagedResult<FoodDto>
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = items.Select(ToDto)
        };
    }

    public async Task<IEnumerable<string>> GetCategoriesAsync(Guid tenantId)
        => await _unitOfWork.Foods.GetCategoriesAsync(tenantId);

    public async Task<FoodDto> GetByIdAsync(Guid tenantId, Guid id)
    {
        var food = await GetFoodAsync(tenantId, id);
        return ToDto(food);
    }

    public async Task<FoodDto> CreateAsync(Guid tenantId, CreateFoodRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("El nombre es obligatorio.", nameof(request.Name));

        var name = request.Name.Trim();
        var existing = await _unitOfWork.Foods.GetByNameAsync(tenantId, name);
        if (existing is not null)
            throw new InvalidOperationException("Ya existe un alimento con ese nombre.");

        var food = new Food
        {
            TenantId = tenantId,
            Name = name,
            Category = request.Category.Trim(),
            Subcategory = request.Subcategory?.Trim(),
            Description = request.Description,
            Unit = string.IsNullOrWhiteSpace(request.Unit) ? "g" : request.Unit.Trim(),
            DefaultQuantity = request.DefaultQuantity <= 0 ? 100 : request.DefaultQuantity,
            Brand = request.Brand?.Trim(),
            Code = request.Code?.Trim(),
            Calories = request.Calories,
            Protein = request.Protein,
            Carbohydrates = request.Carbohydrates,
            Fat = request.Fat,
            Fiber = request.Fiber,
            Sugar = request.Sugar,
            Sodium = request.Sodium,
            Potassium = request.Potassium,
            Calcium = request.Calcium,
            Iron = request.Iron,
            Cholesterol = request.Cholesterol
        };

        await _unitOfWork.Foods.AddAsync(food);
        await _unitOfWork.SaveChangesAsync();

        return ToDto(food);
    }

    public async Task<FoodDto> UpdateAsync(Guid tenantId, Guid id, UpdateFoodRequest request)
    {
        var food = await GetFoodAsync(tenantId, id);

        var name = request.Name.Trim();
        var existing = await _unitOfWork.Foods.GetByNameAsync(tenantId, name);
        if (existing is not null && existing.Id != id)
            throw new InvalidOperationException("Ya existe un alimento con ese nombre.");

        food.Name = name;
        food.Category = request.Category.Trim();
        food.Subcategory = request.Subcategory?.Trim();
        food.Description = request.Description;
        food.Unit = string.IsNullOrWhiteSpace(request.Unit) ? "g" : request.Unit.Trim();
        food.DefaultQuantity = request.DefaultQuantity <= 0 ? 100 : request.DefaultQuantity;
        food.Brand = request.Brand?.Trim();
        food.Code = request.Code?.Trim();
        food.Calories = request.Calories;
        food.Protein = request.Protein;
        food.Carbohydrates = request.Carbohydrates;
        food.Fat = request.Fat;
        food.Fiber = request.Fiber;
        food.Sugar = request.Sugar;
        food.Sodium = request.Sodium;
        food.Potassium = request.Potassium;
        food.Calcium = request.Calcium;
        food.Iron = request.Iron;
        food.Cholesterol = request.Cholesterol;
        food.Status = Enum.TryParse<UserStatus>(request.Status, true, out var status) ? status : UserStatus.Active;
        food.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Foods.UpdateAsync(food);
        await _unitOfWork.SaveChangesAsync();

        return ToDto(food);
    }

    public async Task DeleteAsync(Guid tenantId, Guid id)
    {
        var food = await GetFoodAsync(tenantId, id);
        await _unitOfWork.Foods.DeleteAsync(food);
        await _unitOfWork.SaveChangesAsync();
    }

    private async Task<Food> GetFoodAsync(Guid tenantId, Guid id)
    {
        var food = await _unitOfWork.Foods.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Alimento no encontrado.");
        if (food.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese alimento.");
        return food;
    }

    private static FoodDto ToDto(Food food)
        => new()
        {
            Id = food.Id,
            Name = food.Name,
            Category = food.Category,
            Subcategory = food.Subcategory,
            Description = food.Description,
            Unit = food.Unit,
            DefaultQuantity = food.DefaultQuantity,
            Brand = food.Brand,
            Code = food.Code,
            Status = food.Status.ToString(),
            Calories = food.Calories,
            Protein = food.Protein,
            Carbohydrates = food.Carbohydrates,
            Fat = food.Fat,
            Fiber = food.Fiber,
            Sugar = food.Sugar,
            Sodium = food.Sodium,
            Potassium = food.Potassium,
            Calcium = food.Calcium,
            Iron = food.Iron,
            Cholesterol = food.Cholesterol
        };
}
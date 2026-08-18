using Microsoft.AspNetCore.Identity;
using MyFitnessLife.Domain.Entities.Common;
using MyFitnessLife.Domain.Enums;

namespace MyFitnessLife.Domain.Entities;

public class ApplicationUser : IdentityUser<Guid>
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public Guid? TenantId { get; set; }
    public UserRole Role { get; set; } = UserRole.Patient;
    public UserStatus Status { get; set; } = UserStatus.Active;
    public string? Provider { get; set; }
    public string? GoogleSubject { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public Tenant? Tenant { get; set; }
    public string FullName => $"{FirstName} {LastName}".Trim();
}

public class ApplicationRole : IdentityRole<Guid>
{
    public ApplicationRole() { }
    public ApplicationRole(string roleName) : base(roleName) { }
}

public class Tenant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid? OwnedBy { get; set; }
    public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
}

public class Invitation : BaseEntity
{
    public Guid TenantId { get; set; }
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public Guid InvitedBy { get; set; }
    public string Token { get; set; } = string.Empty;
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
    public DateTime ExpiresAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? SentAt { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }

    public Tenant? Tenant { get; set; }
    public ApplicationUser? InvitedByUser { get; set; }
}

public class OutboxMessage : BaseEntity
{
    public Guid? TenantId { get; set; }
    public string Recipient { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;      // "invitation", "notification"
    public string? Subject { get; set; }
    public string? BodyHtml { get; set; }
    public string? Payload { get; set; }                 // JSON
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;
    public int Attempts { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? NextAttemptAt { get; set; }
    public string? LastError { get; set; }
}

public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
    public bool IsUsed { get; set; }
    public string? ReplacedByToken { get; set; }
    public string? RevokedReason { get; set; }

    public ApplicationUser? User { get; set; }
}

public class AuditLog : BaseEntity
{
    public Guid? TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string Entity { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
}

public class Patient : BaseEntityTenant
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? ProfilePhotoUrl { get; set; }
    public string? Notes { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;

    public string FullName => $"{FirstName} {LastName}".Trim();
}

public class Measurement : BaseEntityTenant
{
    public Guid PatientId { get; set; }
    public DateTime VisitDate { get; set; } = DateTime.UtcNow;

    // Medidas basicas
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? BodyFatPct { get; set; }
    public decimal? MuscleMassKg { get; set; }
    public decimal? BoneMassKg { get; set; }
    public decimal? BodyWaterPct { get; set; }
    public decimal? BasalMetabolism { get; set; }

    // Circunferencias (cm)
    public decimal? ChestCm { get; set; }
    public decimal? WaistCm { get; set; }
    public decimal? HipCm { get; set; }
    public decimal? ArmCm { get; set; }
    public decimal? ForearmCm { get; set; }
    public decimal? ThighCm { get; set; }
    public decimal? CalfCm { get; set; }
    public decimal? NeckCm { get; set; }

    // Signos vitales
    public decimal? HeartRateBpm { get; set; }
    public decimal? SystolicMmHg { get; set; }
    public decimal? DiastolicMmHg { get; set; }
    public decimal? OxygenSaturationPct { get; set; }
    public decimal? RespiratoryRate { get; set; }
    public decimal? TemperatureC { get; set; }

    public string? Notes { get; set; }
    public int? WaistHipRatioPoints { get; set; }

    public Patient? Patient { get; set; }
}

public class Appointment : BaseEntityTenant
{
    public Guid PatientId { get; set; }
    public Guid ProfessionalId { get; set; }
    public Guid? DietId { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;
    public string? Title { get; set; }
    public string? Notes { get; set; }

    public Patient? Patient { get; set; }
    public ApplicationUser? Professional { get; set; }
    public Diet? Diet { get; set; }
}

public class Food : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Subcategory { get; set; }
    public string? Description { get; set; }
    public string Unit { get; set; } = "g";
    public decimal DefaultQuantity { get; set; } = 100;
    public string? Brand { get; set; }
    public string? Code { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;

    // Nutrición por 100 g / 100 ml
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

public class Diet : BaseEntityTenant
{
    public string Name { get; set; } = string.Empty;
    public Guid? PatientId { get; set; }
    public string? Objective { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Observations { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;

    // Objetivos nutricionales diarios
    public decimal? GoalCalories { get; set; }
    public decimal? GoalProtein { get; set; }
    public decimal? GoalCarbs { get; set; }
    public decimal? GoalFat { get; set; }
    public decimal? GoalFiber { get; set; }

    public Patient? Patient { get; set; }
    public ICollection<Meal> Meals { get; set; } = new List<Meal>();
}

public class Meal : BaseEntityTenant
{
    public Guid DietId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ScheduledTime { get; set; }
    public string? Instructions { get; set; }
    public int SortOrder { get; set; }

    public Diet? Diet { get; set; }
    public ICollection<MealItem> Items { get; set; } = new List<MealItem>();
}

public class MealItem : BaseEntityTenant
{
    public Guid MealId { get; set; }
    public Guid FoodId { get; set; }
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "g";

    public Meal? Meal { get; set; }
    public Food? Food { get; set; }
}

public class PatientDiet : BaseEntityTenant
{
    public Guid PatientId { get; set; }
    public Guid DietId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    public Patient? Patient { get; set; }
    public Diet? Diet { get; set; }
}

public class Exercise : BaseEntity
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
    public UserStatus Status { get; set; } = UserStatus.Active;
}

public class PatientPhoto : BaseEntityTenant
{
    public Guid PatientId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public DateTime TakenAt { get; set; } = DateTime.UtcNow;

    public Patient? Patient { get; set; }
}

public class WorkoutPlan : BaseEntityTenant
{
    public string Name { get; set; } = string.Empty;
    public Guid? PatientId { get; set; }
    public string? Objective { get; set; }
    public string? Observations { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;

    public Patient? Patient { get; set; }
    public ICollection<WorkoutDay> Days { get; set; } = new List<WorkoutDay>();
}

public class WorkoutDay : BaseEntityTenant
{
    public Guid PlanId { get; set; }
    public string DayName { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public int SortOrder { get; set; }

    public WorkoutPlan? Plan { get; set; }
    public ICollection<WorkoutExercise> Exercises { get; set; } = new List<WorkoutExercise>();
}

public class WorkoutExercise : BaseEntityTenant
{
    public Guid DayId { get; set; }
    public Guid ExerciseId { get; set; }
    public int? Sets { get; set; }
    public string? Reps { get; set; }
    public int? RestSeconds { get; set; }
    public string? Notes { get; set; }
    public int SortOrder { get; set; }

    public WorkoutDay? Day { get; set; }
    public Exercise? Exercise { get; set; }
}
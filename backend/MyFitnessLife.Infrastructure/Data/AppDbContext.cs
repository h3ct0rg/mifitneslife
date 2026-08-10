using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using MyFitnessLife.Domain.Entities;

namespace MyFitnessLife.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Measurement> Measurements => Set<Measurement>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<Food> Foods => Set<Food>();
    public DbSet<Diet> Diets => Set<Diet>();
    public DbSet<Meal> Meals => Set<Meal>();
    public DbSet<MealItem> MealItems => Set<MealItem>();
    public DbSet<PatientDiet> PatientDiets => Set<PatientDiet>();
    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<WorkoutPlan> WorkoutPlans => Set<WorkoutPlan>();
    public DbSet<WorkoutDay> WorkoutDays => Set<WorkoutDay>();
    public DbSet<WorkoutExercise> WorkoutExercises => Set<WorkoutExercise>();
    public DbSet<PatientPhoto> PatientPhotos => Set<PatientPhoto>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Tenant>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Name).HasMaxLength(150).IsRequired();
            e.Property(t => t.Slug).HasMaxLength(150).IsRequired();
            e.HasIndex(t => t.Slug).IsUnique();
            e.HasMany(t => t.Users)
                .WithOne(u => u.Tenant!)
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<ApplicationUser>(e =>
        {
            e.Property(u => u.FirstName).HasMaxLength(100);
            e.Property(u => u.LastName).HasMaxLength(100);
            e.HasIndex(u => u.GoogleSubject)
                .IsUnique()
                .HasFilter("[GoogleSubject] IS NOT NULL");
        });

        builder.Entity<Invitation>(e =>
        {
            e.Property(i => i.Email).HasMaxLength(256).IsRequired();
            e.Property(i => i.Token).HasMaxLength(128).IsRequired();
            e.HasIndex(i => i.Token).IsUnique();
            e.HasIndex(i => new { i.TenantId, i.Email });
            e.HasOne(i => i.Tenant)
                .WithMany()
                .HasForeignKey(i => i.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<OutboxMessage>(e =>
        {
            e.Property(m => m.Recipient).HasMaxLength(256).IsRequired();
            e.Property(m => m.Type).HasMaxLength(50).IsRequired();
            e.HasIndex(m => m.Status);
            e.HasIndex(m => m.NextAttemptAt);
        });

        builder.Entity<RefreshToken>(e =>
        {
            e.HasIndex(r => r.Token).IsUnique();
            e.Property(r => r.Token).HasMaxLength(256).IsRequired();
            e.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AuditLog>(e =>
        {
            e.Property(a => a.Action).HasMaxLength(100).IsRequired();
            e.Property(a => a.Entity).HasMaxLength(100).IsRequired();
            e.HasIndex(a => a.TenantId);
            e.HasIndex(a => a.Timestamp);
        });

        builder.Entity<Patient>(e =>
        {
            e.Property(p => p.FirstName).HasMaxLength(100).IsRequired();
            e.Property(p => p.LastName).HasMaxLength(100).IsRequired();
            e.Property(p => p.Email).HasMaxLength(256).IsRequired();
            e.Property(p => p.Phone).HasMaxLength(30);
            e.Property(p => p.ProfilePhotoUrl).HasMaxLength(500);
            e.Property(p => p.Notes).HasMaxLength(2000);
            e.HasIndex(p => p.TenantId);
            e.HasIndex(p => new { p.TenantId, p.Email }).IsUnique();
        });

        builder.Entity<Measurement>(e =>
        {
            e.Property(m => m.Notes).HasMaxLength(2000);
            e.HasIndex(m => m.PatientId);
            e.HasIndex(m => new { m.PatientId, m.VisitDate });
            e.HasOne(m => m.Patient)
                .WithMany()
                .HasForeignKey(m => m.PatientId)
                .OnDelete(DeleteBehavior.Cascade);

            foreach (var prop in typeof(Measurement).GetProperties()
                .Where(p => p.PropertyType == typeof(decimal?) || p.PropertyType == typeof(decimal)))
            {
                e.Property(prop.Name).HasPrecision(18, 2);
            }
        });

        builder.Entity<Appointment>(e =>
        {
            e.HasIndex(a => new { a.TenantId, a.StartAt });
            e.HasOne(a => a.Patient)
                .WithMany()
                .HasForeignKey(a => a.PatientId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.Professional)
                .WithMany()
                .HasForeignKey(a => a.ProfessionalId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(a => a.Diet)
                .WithMany()
                .HasForeignKey(a => a.DietId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<Food>(e =>
        {
            e.Property(f => f.Name).HasMaxLength(200).IsRequired();
            e.Property(f => f.Category).HasMaxLength(100).IsRequired();
            e.Property(f => f.Subcategory).HasMaxLength(100);
            e.Property(f => f.Unit).HasMaxLength(20).IsRequired();
            e.Property(f => f.Brand).HasMaxLength(150);
            e.Property(f => f.Code).HasMaxLength(100);
            e.HasIndex(f => new { f.TenantId, f.Name }).IsUnique();

            foreach (var prop in typeof(Food).GetProperties()
                .Where(p => p.PropertyType == typeof(decimal) || p.PropertyType == typeof(decimal?)))
            {
                e.Property(prop.Name).HasPrecision(18, 2);
            }
        });

        builder.Entity<Diet>(e =>
        {
            e.Property(d => d.Name).HasMaxLength(200).IsRequired();
            e.Property(d => d.Objective).HasMaxLength(200);
            e.HasOne(d => d.Patient)
                .WithMany()
                .HasForeignKey(d => d.PatientId)
                .OnDelete(DeleteBehavior.SetNull);

            foreach (var prop in typeof(Diet).GetProperties()
                .Where(p => p.PropertyType == typeof(decimal) || p.PropertyType == typeof(decimal?)))
            {
                e.Property(prop.Name).HasPrecision(18, 2);
            }
        });

        builder.Entity<Meal>(e =>
        {
            e.Property(m => m.Name).HasMaxLength(100).IsRequired();
            e.Property(m => m.ScheduledTime).HasMaxLength(10);
            e.HasOne(m => m.Diet)
                .WithMany(d => d.Meals)
                .HasForeignKey(m => m.DietId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<MealItem>(e =>
        {
            e.HasOne(mi => mi.Meal)
                .WithMany(m => m.Items)
                .HasForeignKey(mi => mi.MealId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(mi => mi.Food)
                .WithMany()
                .HasForeignKey(mi => mi.FoodId)
                .OnDelete(DeleteBehavior.Restrict);

            foreach (var prop in typeof(MealItem).GetProperties()
                .Where(p => p.PropertyType == typeof(decimal) || p.PropertyType == typeof(decimal?)))
            {
                e.Property(prop.Name).HasPrecision(18, 2);
            }
        });

        builder.Entity<PatientDiet>(e =>
        {
            e.HasIndex(pd => new { pd.PatientId, pd.IsActive });
            e.HasOne(pd => pd.Patient)
                .WithMany()
                .HasForeignKey(pd => pd.PatientId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(pd => pd.Diet)
                .WithMany()
                .HasForeignKey(pd => pd.DietId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Exercise>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(250).IsRequired();
            e.Property(x => x.Category).HasMaxLength(100);
            e.Property(x => x.BodyPart).HasMaxLength(100);
            e.Property(x => x.Equipment).HasMaxLength(100);
            e.Property(x => x.Target).HasMaxLength(150);
            e.Property(x => x.MuscleGroup).HasMaxLength(150);
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.Property(x => x.GifUrl).HasMaxLength(500);
            e.HasIndex(x => x.Name);
        });

        builder.Entity<WorkoutPlan>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(200).IsRequired();
            e.HasOne(p => p.Patient)
                .WithMany()
                .HasForeignKey(p => p.PatientId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<WorkoutDay>(e =>
        {
            e.Property(d => d.DayName).HasMaxLength(100).IsRequired();
            e.HasOne(d => d.Plan)
                .WithMany(p => p.Days)
                .HasForeignKey(d => d.PlanId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WorkoutExercise>(e =>
        {
            e.HasOne(we => we.Day)
                .WithMany(d => d.Exercises)
                .HasForeignKey(we => we.DayId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(we => we.Exercise)
                .WithMany()
                .HasForeignKey(we => we.ExerciseId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<PatientPhoto>(e =>
        {
            e.Property(p => p.FileName).HasMaxLength(300).IsRequired();
            e.HasIndex(p => new { p.PatientId, p.TakenAt });
            e.HasOne(p => p.Patient)
                .WithMany()
                .HasForeignKey(p => p.PatientId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
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
            e.HasOne(i => i.Tenant)
                .WithMany()
                .HasForeignKey(i => i.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
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
    }
}
using Microsoft.EntityFrameworkCore;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;
using MyFitnessLife.Infrastructure.Data;

namespace MyFitnessLife.Infrastructure.Repositories;

/// <summary>
/// Borrado físico de tenants y usuarios.
///
/// Mapa de FKs (AppDbContext / snapshot) que condiciona el orden:
///   Appointment.ProfessionalId → User   RESTRICT   (se borra la cita antes que el usuario)
///   Appointment.PatientId      → Patient CASCADE
///   Appointment.DietId         → Diet    SET NULL
///   PatientDiet.DietId         → Diet    RESTRICT   (se borra antes que la dieta)
///   PatientDiet.PatientId      → Patient CASCADE
///   MealItem.MealId → Meal CASCADE; Meal.DietId → Diet CASCADE; MealItem.FoodId → Food RESTRICT (catálogo, no se borra)
///   WorkoutExercise.DayId → Day CASCADE; Day.PlanId → Plan CASCADE; WorkoutExercise.ExerciseId → Exercise RESTRICT (catálogo)
///   Diet.PatientId / WorkoutPlan.PatientId → Patient SET NULL
///   Measurement / PatientPhoto .PatientId → Patient CASCADE
///   Invitation.TenantId → Tenant CASCADE; Invitation.InvitedByUserId (sombra) → User NO ACTION
///   RefreshToken / AspNetUser{Roles,Claims,Logins,Tokens} .UserId → User CASCADE
///   User.TenantId → Tenant SET NULL
///   Sin FK (columna lógica): *.TenantId de entidades tenant-scoped, AuditLog.TenantId/UserId,
///   OutboxMessage.TenantId, Invitation.InvitedBy, Tenant.OwnedBy.
/// No se depende de las cascadas: cada tabla se limpia explícitamente de hojas a raíz.
/// </summary>
public class DataPurgeRepository : IDataPurgeRepository
{
    private const string InvitedByUserIdShadow = "InvitedByUserId";

    private readonly AppDbContext _context;

    public DataPurgeRepository(AppDbContext context) => _context = context;

    // ───────────────────────────── Tenant ─────────────────────────────

    /// <summary>Consultas (sin ejecutar) de todo lo que se elimina con un tenant.</summary>
    private sealed class TenantScope
    {
        public required IQueryable<Guid> UserIds { get; init; }
        public required IQueryable<ApplicationUser> Users { get; init; }
        public required IQueryable<Patient> Patients { get; init; }
        public required IQueryable<Appointment> Appointments { get; init; }
        public required IQueryable<PatientDiet> PatientDiets { get; init; }
        public required IQueryable<MealItem> MealItems { get; init; }
        public required IQueryable<Meal> Meals { get; init; }
        public required IQueryable<Diet> Diets { get; init; }
        public required IQueryable<WorkoutExercise> WorkoutExercises { get; init; }
        public required IQueryable<WorkoutDay> WorkoutDays { get; init; }
        public required IQueryable<WorkoutPlan> WorkoutPlans { get; init; }
        public required IQueryable<Measurement> Measurements { get; init; }
        public required IQueryable<PatientPhoto> PatientPhotos { get; init; }
        public required IQueryable<Invitation> Invitations { get; init; }
        public required IQueryable<OutboxMessage> Outbox { get; init; }
        public required IQueryable<AuditLog> AuditLogs { get; init; }
    }

    private TenantScope BuildTenantScope(Guid t)
    {
        // Los SuperAdmin nunca se eliminan con un tenant (D2 tarea previa: no tienen tenant).
        var users = _context.Users.Where(u => u.TenantId == t && u.Role != UserRole.SuperAdmin);
        var userIds = users.Select(u => u.Id);
        var userEmails = users.Where(u => u.Email != null).Select(u => u.Email!);

        return new TenantScope
        {
            UserIds = userIds,
            Users = users,
            Patients = _context.Patients.Where(p => p.TenantId == t),
            Appointments = _context.Appointments.Where(a =>
                a.TenantId == t || a.Patient!.TenantId == t || userIds.Contains(a.ProfessionalId)),
            PatientDiets = _context.PatientDiets.Where(pd =>
                pd.TenantId == t || pd.Patient!.TenantId == t || pd.Diet!.TenantId == t),
            MealItems = _context.MealItems.Where(mi => mi.TenantId == t || mi.Meal!.Diet!.TenantId == t),
            Meals = _context.Meals.Where(m => m.TenantId == t || m.Diet!.TenantId == t),
            Diets = _context.Diets.Where(d => d.TenantId == t),
            WorkoutExercises = _context.WorkoutExercises.Where(we => we.TenantId == t || we.Day!.Plan!.TenantId == t),
            WorkoutDays = _context.WorkoutDays.Where(wd => wd.TenantId == t || wd.Plan!.TenantId == t),
            WorkoutPlans = _context.WorkoutPlans.Where(wp => wp.TenantId == t),
            Measurements = _context.Measurements.Where(m => m.TenantId == t || m.Patient!.TenantId == t),
            PatientPhotos = _context.PatientPhotos.Where(p => p.TenantId == t || p.Patient!.TenantId == t),
            Invitations = _context.Invitations.Where(i =>
                i.TenantId == t
                || userIds.Contains(i.InvitedBy)
                || (EF.Property<Guid?>(i, InvitedByUserIdShadow) != null
                    && userIds.Contains(EF.Property<Guid?>(i, InvitedByUserIdShadow)!.Value))
                || userEmails.Contains(i.Email)),
            Outbox = _context.OutboxMessages.Where(o => o.TenantId == t),
            AuditLogs = _context.AuditLogs.Where(a => a.TenantId == t)
        };
    }

    public async Task<TenantDeleteImpact> GetTenantImpactAsync(Guid tenantId)
    {
        var s = BuildTenantScope(tenantId);

        var users = await s.Users.CountAsync();
        var patients = await s.Patients.CountAsync();
        var appointments = await s.Appointments.CountAsync();

        var other = 0;
        other += await s.PatientDiets.CountAsync();
        other += await s.MealItems.CountAsync();
        other += await s.Meals.CountAsync();
        other += await s.Diets.CountAsync();
        other += await s.WorkoutExercises.CountAsync();
        other += await s.WorkoutDays.CountAsync();
        other += await s.WorkoutPlans.CountAsync();
        other += await s.Measurements.CountAsync();
        other += await s.PatientPhotos.CountAsync();
        other += await s.Invitations.CountAsync();
        other += await s.Outbox.CountAsync();
        other += await s.AuditLogs.CountAsync();

        return new TenantDeleteImpact(users, patients, appointments, other);
    }

    public Task PurgeTenantAsync(Guid tenantId, AuditLog deletionEvent)
        => InTransactionAsync(async () =>
        {
            var s = BuildTenantScope(tenantId);
            var t = tenantId;

            // 1. Citas (RESTRICT sobre el profesional).
            await s.Appointments.ExecuteDeleteAsync();
            // 2. Asignaciones dieta-paciente (RESTRICT sobre la dieta).
            await s.PatientDiets.ExecuteDeleteAsync();
            // 3. Dietas: items → comidas → dietas.
            await s.MealItems.ExecuteDeleteAsync();
            await s.Meals.ExecuteDeleteAsync();
            await s.Diets.ExecuteDeleteAsync();
            // 4. Planes: ejercicios → días → planes.
            await s.WorkoutExercises.ExecuteDeleteAsync();
            await s.WorkoutDays.ExecuteDeleteAsync();
            await s.WorkoutPlans.ExecuteDeleteAsync();
            // 5. Datos clínicos del paciente.
            await s.Measurements.ExecuteDeleteAsync();
            await s.PatientPhotos.ExecuteDeleteAsync();
            // 6. Referencias desde OTROS tenants a pacientes de este (SET NULL explícito).
            await _context.Diets.Where(d => d.TenantId != t && d.Patient!.TenantId == t)
                .ExecuteUpdateAsync(u => u.SetProperty(d => d.PatientId, (Guid?)null));
            await _context.WorkoutPlans.Where(p => p.TenantId != t && p.Patient!.TenantId == t)
                .ExecuteUpdateAsync(u => u.SetProperty(p => p.PatientId, (Guid?)null));
            // 7. Pacientes.
            await s.Patients.ExecuteDeleteAsync();
            // 8. Invitaciones, outbox y auditoría del tenant.
            await s.Invitations.ExecuteDeleteAsync();
            await s.Outbox.ExecuteDeleteAsync();
            await s.AuditLogs.ExecuteDeleteAsync();
            // 9. Usuarios del tenant: referencias lógicas → artefactos de auth → cuenta.
            await _context.AuditLogs.Where(a => a.UserId != null && s.UserIds.Contains(a.UserId.Value))
                .ExecuteUpdateAsync(u => u.SetProperty(a => a.UserId, (Guid?)null));
            await _context.Tenants.Where(x => x.OwnedBy != null && s.UserIds.Contains(x.OwnedBy.Value))
                .ExecuteUpdateAsync(u => u.SetProperty(x => x.OwnedBy, (Guid?)null));
            await DeleteAuthArtifactsAsync(s.UserIds);
            await s.Users.ExecuteDeleteAsync();
            // 10. Tenant (un SuperAdmin con TenantId residual queda en NULL por la FK SET NULL).
            await _context.Users.Where(u => u.TenantId == t)
                .ExecuteUpdateAsync(u => u.SetProperty(x => x.TenantId, (Guid?)null));
            await _context.Tenants.Where(x => x.Id == t).ExecuteDeleteAsync();
        }, deletionEvent);

    // ───────────────────────────── Usuario ─────────────────────────────

    private sealed class UserScope
    {
        public required IQueryable<Guid> UserIds { get; init; }
        public required IQueryable<Guid> PatientIds { get; init; }
        public required IQueryable<Appointment> Appointments { get; init; }
        public required IQueryable<Measurement> Measurements { get; init; }
        public required IQueryable<PatientPhoto> PatientPhotos { get; init; }
        public required IQueryable<PatientDiet> PatientDiets { get; init; }
        public required IQueryable<Invitation> Invitations { get; init; }
    }

    private async Task<UserScope?> BuildUserScopeAsync(Guid userId)
    {
        var user = await _context.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Id, u.Email, u.TenantId, u.Role })
            .FirstOrDefaultAsync();
        if (user is null)
            return null;

        var email = user.Email ?? string.Empty;

        // D3: solo si el rol es Patient se elimina su ficha (match email + tenant).
        var patientIds = user.Role == UserRole.Patient && user.TenantId.HasValue && email.Length > 0
            ? _context.Patients.Where(p => p.TenantId == user.TenantId.Value && p.Email == email).Select(p => p.Id)
            : _context.Patients.Where(_ => false).Select(p => p.Id);

        return new UserScope
        {
            UserIds = _context.Users.Where(u => u.Id == userId).Select(u => u.Id),
            PatientIds = patientIds,
            Appointments = _context.Appointments.Where(a => a.ProfessionalId == userId || patientIds.Contains(a.PatientId)),
            Measurements = _context.Measurements.Where(m => patientIds.Contains(m.PatientId)),
            PatientPhotos = _context.PatientPhotos.Where(p => patientIds.Contains(p.PatientId)),
            PatientDiets = _context.PatientDiets.Where(pd => patientIds.Contains(pd.PatientId)),
            Invitations = _context.Invitations.Where(i =>
                i.InvitedBy == userId
                || EF.Property<Guid?>(i, InvitedByUserIdShadow) == userId
                || (email.Length > 0 && i.Email == email))
        };
    }

    public async Task<UserDeleteImpact> GetUserImpactAsync(Guid userId)
    {
        var s = await BuildUserScopeAsync(userId)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        var patientProfile = await s.PatientIds.AnyAsync();
        var appointments = await s.Appointments.CountAsync();

        var other = 0;
        other += await s.Measurements.CountAsync();
        other += await s.PatientPhotos.CountAsync();
        other += await s.PatientDiets.CountAsync();
        other += await s.Invitations.CountAsync();

        return new UserDeleteImpact(patientProfile, appointments, other);
    }

    public Task PurgeUserAsync(Guid userId, AuditLog deletionEvent)
        => InTransactionAsync(async () =>
        {
            var s = await BuildUserScopeAsync(userId)
                ?? throw new KeyNotFoundException("Usuario no encontrado.");

            // 1. Citas como profesional (RESTRICT) o como paciente.
            await s.Appointments.ExecuteDeleteAsync();
            // 2. Ficha Patient y sus dependientes (si aplica).
            await s.Measurements.ExecuteDeleteAsync();
            await s.PatientPhotos.ExecuteDeleteAsync();
            await s.PatientDiets.ExecuteDeleteAsync();
            await _context.Diets.Where(d => d.PatientId != null && s.PatientIds.Contains(d.PatientId.Value))
                .ExecuteUpdateAsync(u => u.SetProperty(d => d.PatientId, (Guid?)null));
            await _context.WorkoutPlans.Where(p => p.PatientId != null && s.PatientIds.Contains(p.PatientId.Value))
                .ExecuteUpdateAsync(u => u.SetProperty(p => p.PatientId, (Guid?)null));
            await _context.Patients.Where(p => s.PatientIds.Contains(p.Id)).ExecuteDeleteAsync();
            // 3. Invitaciones enviadas/recibidas.
            await s.Invitations.ExecuteDeleteAsync();
            // 4. Referencias lógicas sin FK.
            await _context.AuditLogs.Where(a => a.UserId == userId)
                .ExecuteUpdateAsync(u => u.SetProperty(a => a.UserId, (Guid?)null));
            await _context.Tenants.Where(x => x.OwnedBy == userId)
                .ExecuteUpdateAsync(u => u.SetProperty(x => x.OwnedBy, (Guid?)null));
            // 5. Artefactos de auth y cuenta.
            await DeleteAuthArtifactsAsync(s.UserIds);
            await _context.Users.Where(u => u.Id == userId).ExecuteDeleteAsync();
        }, deletionEvent);

    // ───────────────────────────── Comunes ─────────────────────────────

    private async Task DeleteAuthArtifactsAsync(IQueryable<Guid> userIds)
    {
        await _context.RefreshTokens.Where(r => userIds.Contains(r.UserId)).ExecuteDeleteAsync();
        await _context.UserRoles.Where(r => userIds.Contains(r.UserId)).ExecuteDeleteAsync();
        await _context.UserClaims.Where(c => userIds.Contains(c.UserId)).ExecuteDeleteAsync();
        await _context.UserLogins.Where(l => userIds.Contains(l.UserId)).ExecuteDeleteAsync();
        await _context.UserTokens.Where(x => userIds.Contains(x.UserId)).ExecuteDeleteAsync();
    }

    private async Task InTransactionAsync(Func<Task> purge, AuditLog deletionEvent)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            // ExecuteDelete/Update no pasan por el ChangeTracker: se limpia para no
            // re-guardar entidades ya borradas al insertar el evento de auditoría.
            _context.ChangeTracker.Clear();

            await using var tx = await _context.Database.BeginTransactionAsync();
            await purge();

            await _context.AuditLogs.AddAsync(deletionEvent);
            await _context.SaveChangesAsync();

            await tx.CommitAsync();
            _context.ChangeTracker.Clear();
        });
    }
}

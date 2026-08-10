using MyFitnessLife.Domain.Interfaces;
using MyFitnessLife.Infrastructure.Data;

namespace MyFitnessLife.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
        Users = new UserRepository(context);
        Tenants = new TenantRepository(context);
        Invitations = new InvitationRepository(context);
        RefreshTokens = new RefreshTokenRepository(context);
        AuditLogs = new AuditLogRepository(context);
        Patients = new PatientRepository(context);
        Measurements = new MeasurementRepository(context);
        Appointments = new AppointmentRepository(context);
        Foods = new FoodRepository(context);
        Diets = new DietRepository(context);
        PatientDiets = new PatientDietRepository(context);
        Exercises = new ExerciseRepository(context);
        WorkoutPlans = new WorkoutPlanRepository(context);
        PatientPhotos = new PatientPhotoRepository(context);
    }

    public IUserRepository Users { get; }
    public ITenantRepository Tenants { get; }
    public IInvitationRepository Invitations { get; }
    public IRefreshTokenRepository RefreshTokens { get; }
    public IAuditLogRepository AuditLogs { get; }
    public IPatientRepository Patients { get; }
    public IMeasurementRepository Measurements { get; }
    public IAppointmentRepository Appointments { get; }
    public IFoodRepository Foods { get; }
    public IDietRepository Diets { get; }
    public IPatientDietRepository PatientDiets { get; }
    public IExerciseRepository Exercises { get; }
    public IWorkoutPlanRepository WorkoutPlans { get; }
    public IPatientPhotoRepository PatientPhotos { get; }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => _context.SaveChangesAsync(cancellationToken);

    public void Dispose() => _context.Dispose();
    public ValueTask DisposeAsync() => _context.DisposeAsync();
}
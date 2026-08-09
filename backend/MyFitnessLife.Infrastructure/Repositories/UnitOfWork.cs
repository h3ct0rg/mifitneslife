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
    }

    public IUserRepository Users { get; }
    public ITenantRepository Tenants { get; }
    public IInvitationRepository Invitations { get; }
    public IRefreshTokenRepository RefreshTokens { get; }
    public IAuditLogRepository AuditLogs { get; }
    public IPatientRepository Patients { get; }
    public IMeasurementRepository Measurements { get; }
    public IAppointmentRepository Appointments { get; }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => _context.SaveChangesAsync(cancellationToken);

    public void Dispose() => _context.Dispose();
    public ValueTask DisposeAsync() => _context.DisposeAsync();
}
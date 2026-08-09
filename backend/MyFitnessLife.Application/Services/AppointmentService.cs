using MyFitnessLife.Application.DTOs.Appointments;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Application.Mapping;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class AppointmentService : IAppointmentService
{
    private readonly IUnitOfWork _unitOfWork;

    public AppointmentService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<AppointmentDto>> GetByRangeAsync(Guid tenantId, DateTime from, DateTime to)
    {
        var appointments = await _unitOfWork.Appointments.GetByRangeAsync(tenantId, from, to);
        return appointments.Select(ToDto);
    }

    public async Task<AppointmentDto> CreateAsync(Guid tenantId, CreateAppointmentRequest request)
    {
        if (request.StartAt == default)
            throw new ArgumentException("La fecha de inicio es obligatoria.", nameof(request.StartAt));

        var proportional = await GetProfessionalAsync(tenantId, request.ProfessionalId);
        if (proportional is null)
            throw new KeyNotFoundException("El profesional seleccionado no pertenece a este centro.");

        if (!await PatientExistsAsync(tenantId, request.PatientId))
            throw new KeyNotFoundException("Paciente no encontrado.");

        var appointment = request.ToEntity();
        appointment.TenantId = tenantId;
        appointment.ProfessionalId = proportional.Id;

        if (request.DietId.HasValue)
            appointment.DietId = await EnsureDietAsync(tenantId, request.PatientId, request.DietId.Value);

        await _unitOfWork.Appointments.AddAsync(appointment);
        await _unitOfWork.SaveChangesAsync();

        return await GetByIdAsync(tenantId, appointment.Id);
    }

    public async Task<AppointmentDto> UpdateAsync(Guid tenantId, Guid id, UpdateAppointmentRequest request)
    {
        var appointment = await _unitOfWork.Appointments.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Cita no encontrada.");
        if (appointment.TenantId != tenantId)
            throw new UnauthorizedAccessException("Acceso denegado a la cita.");

        var professional = await GetProfessionalAsync(tenantId, request.ProfessionalId);
        if (professional is null)
            throw new KeyNotFoundException("El profesional seleccionado no pertenece a este centro.");

        if (!await PatientExistsAsync(tenantId, request.PatientId))
            throw new KeyNotFoundException("Paciente no encontrado.");

        request.Apply(appointment);
        appointment.ProfessionalId = professional.Id;

        if (request.DietId.HasValue)
            appointment.DietId = await EnsureDietAsync(tenantId, request.PatientId, request.DietId.Value);
        else
            appointment.DietId = null;

        if (!string.IsNullOrWhiteSpace(request.Status)
            && Enum.TryParse<AppointmentStatus>(request.Status, ignoreCase: true, out var newStatus))
        {
            appointment.Status = newStatus;
        }

        await _unitOfWork.Appointments.UpdateAsync(appointment);
        await _unitOfWork.SaveChangesAsync();

        return await GetByIdAsync(tenantId, appointment.Id);
    }

    public async Task DeleteAsync(Guid tenantId, Guid id)
    {
        var appointment = await _unitOfWork.Appointments.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Cita no encontrada.");
        if (appointment.TenantId != tenantId)
            throw new UnauthorizedAccessException("Acceso denegado a la cita.");

        await _unitOfWork.Appointments.DeleteAsync(appointment);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<IEnumerable<ProfessionalDto>> GetProfessionalsAsync(Guid tenantId)
    {
        var users = await _unitOfWork.Users.GetByTenantAsync(tenantId);
        var professionals = users
            .Where(u => u.Role == UserRole.Admin
                || u.Role == UserRole.Nutritionist
                || u.Role == UserRole.Trainer)
            .ToList();

        return professionals.Select(p => p.ToProfessionalDto());
    }

    private async Task<ApplicationUser?> GetProfessionalAsync(Guid tenantId, Guid professionalId)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(professionalId);
        if (user is null || user.TenantId != tenantId)
            return null;

        return user.Role == UserRole.Admin
            || user.Role == UserRole.Nutritionist
            || user.Role == UserRole.Trainer
            ? user
            : null;
    }

    private async Task<bool> PatientExistsAsync(Guid tenantId, Guid patientId)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(patientId);
        return patient is not null && patient.TenantId == tenantId;
    }

    private async Task<Guid> EnsureDietAsync(Guid tenantId, Guid patientId, Guid dietId)
    {
        var diet = await _unitOfWork.Diets.GetByIdAsync(dietId)
            ?? throw new KeyNotFoundException("La dieta seleccionada no existe.");
        if (diet.TenantId != tenantId)
            throw new UnauthorizedAccessException("Acceso denegado a la dieta.");

        // Desactivar la asignación activa actual y registrar la nueva en el historial.
        var active = await _unitOfWork.PatientDiets.GetActiveByPatientAsync(patientId);
        if (active is not null)
        {
            active.IsActive = false;
            await _unitOfWork.PatientDiets.UpdateAsync(active);
        }

        await _unitOfWork.PatientDiets.AddAsync(new PatientDiet
        {
            TenantId = tenantId,
            PatientId = patientId,
            DietId = dietId,
            AssignedAt = DateTime.UtcNow,
            IsActive = true
        });

        return dietId;
    }

    private async Task<AppointmentDto> GetByIdAsync(Guid tenantId, Guid id)
    {
        var appointment = await _unitOfWork.Appointments.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Cita no encontrada.");
        if (appointment.TenantId != tenantId)
            throw new UnauthorizedAccessException("Acceso denegado a la cita.");

        return ToDto(appointment);
    }

    private static AppointmentDto ToDto(Appointment appointment)
    {
        var patient = appointment.Patient;
        var professional = appointment.Professional;

        return new AppointmentDto
        {
            Id = appointment.Id,
            PatientId = appointment.PatientId,
            PatientFullName = patient?.FullName ?? "Paciente",
            ProfessionalId = appointment.ProfessionalId,
            ProfessionalFullName = professional?.FullName ?? "Profesional",
            ProfessionalRole = professional?.Role.ToString() ?? string.Empty,
            DietId = appointment.DietId,
            DietName = appointment.Diet?.Name,
            StartAt = appointment.StartAt,
            EndAt = appointment.EndAt,
            Status = appointment.Status.ToString(),
            Title = appointment.Title,
            Notes = appointment.Notes
        };
    }
}
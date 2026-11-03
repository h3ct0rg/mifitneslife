using MyFitnessLife.Application.DTOs.Appointments;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Application.Mapping;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class AppointmentService : IAppointmentService
{
    // D1 (zona horaria): Appointment.StartAt/EndAt son HORA DE RELOJ de la clínica, sin zona
    // (Kind Unspecified), tal como la elige el usuario en el formulario. No se convierten a UTC ni se
    // migran. Valores que lleguen con Z/offset (clientes viejos) se pasan a la zona del cliente.
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmailService _emailService;
    private readonly IClientClock _clock;

    public AppointmentService(IUnitOfWork unitOfWork, IEmailService emailService, IClientClock clock)
    {
        _unitOfWork = unitOfWork;
        _emailService = emailService;
        _clock = clock;
    }

    public async Task<IEnumerable<AppointmentDto>> GetByRangeAsync(Guid tenantId, DateTime from, DateTime to)
    {
        // Contrato: from/to en hora de reloj local sin offset; con Z/offset → zona del header.
        var appointments = await _unitOfWork.Appointments.GetByRangeAsync(tenantId, _clock.ToWallClock(from), _clock.ToWallClock(to));
        return appointments.Select(ToDto);
    }

    public async Task<AppointmentDto> CreateAsync(Guid tenantId, CreateAppointmentRequest request)
    {
        if (request.StartAt == default)
            throw new ArgumentException("La fecha de inicio es obligatoria.", nameof(request.StartAt));
        request.StartAt = _clock.ToWallClock(request.StartAt);
        request.EndAt = request.EndAt.HasValue ? _clock.ToWallClock(request.EndAt.Value) : null;

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

        await EnqueueAppointmentEmailAsync(tenantId, appointment, proportional);

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

        request.StartAt = _clock.ToWallClock(request.StartAt);
        request.EndAt = request.EndAt.HasValue ? _clock.ToWallClock(request.EndAt.Value) : null;
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

    private static readonly UserRole[] StaffRoles = [UserRole.Admin, UserRole.Nutritionist, UserRole.Trainer];

    /// <summary>Multi-rol (D7): profesionales = usuarios con membresía staff activa en el tenant.</summary>
    public async Task<IEnumerable<ProfessionalDto>> GetProfessionalsAsync(Guid tenantId)
    {
        var memberships = await _unitOfWork.Memberships.GetByTenantAsync(tenantId, StaffRoles);
        return memberships
            .Where(m => m.User is not null)
            .GroupBy(m => m.UserId)
            .Select(g =>
            {
                var m = g.OrderBy(x => x.Role).First();
                var dto = m.User!.ToProfessionalDto();
                dto.Role = m.Role.ToString();
                return dto;
            })
            .ToList();
    }

    private async Task<ApplicationUser?> GetProfessionalAsync(Guid tenantId, Guid professionalId)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(professionalId);
        if (user is null)
            return null;

        var memberships = await _unitOfWork.Memberships.GetByUserAsync(professionalId, usableOnly: true);
        return memberships.Any(m => m.TenantId == tenantId && StaffRoles.Contains(m.Role)) ? user : null;
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

    private async Task EnqueueAppointmentEmailAsync(Guid tenantId, Appointment appointment, ApplicationUser professional)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(appointment.PatientId);
        if (patient is null || string.IsNullOrWhiteSpace(patient.Email))
            return;

        // D1: StartAt ya es la hora de reloj de la clínica → se formatea TAL CUAL. No convertir
        // (antes se trataba como UTC y se pasaba a la zona del servidor, desplazando la hora).
        var clinicTime = appointment.StartAt;
        var culture = new System.Globalization.CultureInfo("es-ES");

        var dateLabel = clinicTime.ToString("dddd, d 'de' MMMM 'de' yyyy", culture);
        var timeLabel = clinicTime.ToString("HH:mm 'h'", System.Globalization.CultureInfo.InvariantCulture);

        var html = _emailService.BuildAppointmentEmail(
            patient.FullName,
            professional.FullName,
            dateLabel,
            timeLabel,
            appointment.Title,
            appointment.Notes);

        await _unitOfWork.Outbox.AddAsync(new OutboxMessage
        {
            TenantId = tenantId,
            Recipient = patient.Email,
            Type = "appointment",
            Subject = "Tienes una cita programada · MyFitnessLife",
            BodyHtml = html,
            Status = NotificationStatus.Pending
        });

        await _unitOfWork.SaveChangesAsync();
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
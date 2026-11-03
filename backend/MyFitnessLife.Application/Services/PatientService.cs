using Microsoft.Extensions.Logging;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Application.Mapping;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class PatientService : IPatientService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITenantActivityService _activityService;
    private readonly InvitationDispatcher _invitations;
    private readonly ILogger<PatientService> _logger;

    public PatientService(
        IUnitOfWork unitOfWork,
        ITenantActivityService activityService,
        InvitationDispatcher invitations,
        ILogger<PatientService> logger)
    {
        _unitOfWork = unitOfWork;
        _activityService = activityService;
        _invitations = invitations;
        _logger = logger;
    }

    public async Task<PagedResult<PatientDto>> GetPagedAsync(
        Guid tenantId,
        string? search = null,
        int page = 1,
        int pageSize = 20)
    {
        var items = await _unitOfWork.Patients.GetByTenantAsync(tenantId, search, page, pageSize);
        var total = await _unitOfWork.Patients.CountByTenantAsync(tenantId, search);

        var dtos = items.Select(p => p.ToDto()).ToList();
        await FillAccountFlagsAsync(tenantId, dtos);

        return new PagedResult<PatientDto>
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = dtos
        };
    }

    public async Task<PatientDto> GetByIdAsync(Guid tenantId, Guid id)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Paciente no encontrado.");
        if (patient.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese paciente.");

        return await WithFlagsAsync(tenantId, patient.ToDto());
    }

    public async Task<PatientDto?> GetByEmailAsync(Guid tenantId, string email)
    {
        var patient = await _unitOfWork.Patients.GetByEmailAsync(tenantId, email.Trim().ToLowerInvariant());
        return patient is null ? null : await WithFlagsAsync(tenantId, patient.ToDto());
    }

    public async Task<PatientCreatedDto> CreateAsync(Guid tenantId, Guid actorId, CreatePatientRequest request)
    {
        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        var existing = await _unitOfWork.Patients.GetByEmailAsync(tenantId, email);
        if (existing is not null)
            throw new InvalidOperationException("Ya existe un paciente con ese email en el tenant.");

        var patient = new Patient
        {
            TenantId = tenantId,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Email = email,
            Phone = request.Phone?.Trim(),
            DateOfBirth = request.DateOfBirth,
            ProfilePhotoUrl = request.ProfilePhotoUrl,
            Notes = request.Notes
        };

        await _unitOfWork.Patients.AddAsync(patient);
        await _activityService.RecordEntityAsync(tenantId, "create_patient", "Patient", patient.Id.ToString(), email);
        await _unitOfWork.SaveChangesAsync();

        // D1–D3: la ficha ya está guardada; la invitación solo encola el correo (el envío SMTP
        // lo hace NotificationWorker con reintentos). Un fallo aquí no revierte la creación.
        var status = PatientInvitationStatus.None;
        try
        {
            status = await InviteInternalAsync(tenantId, actorId, email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "No se pudo generar la invitación del paciente {PatientId}.", patient.Id);
            status = PatientInvitationStatus.Failed; // N2: "none" queda solo para "sin email válido".
        }

        var dto = patient.ToDto<PatientCreatedDto>();
        dto.InvitationStatus = status;
        await FillAccountFlagsAsync(tenantId, [dto]);
        return dto;
    }

    public async Task<PatientInviteResultDto> InviteAsync(Guid tenantId, Guid actorId, Guid patientId)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(patientId);
        if (patient is null || patient.TenantId != tenantId)
            throw new KeyNotFoundException("Paciente no encontrado.");

        var email = patient.Email.Trim().ToLowerInvariant();
        if (!InvitationDispatcher.IsValidEmail(email))
            throw new InvalidOperationException("El paciente no tiene un email válido.");

        return new PatientInviteResultDto
        {
            InvitationStatus = await InviteInternalAsync(tenantId, actorId, email)
        };
    }

    public async Task<PatientDto> UpdateAsync(Guid tenantId, Guid id, UpdatePatientRequest request)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Paciente no encontrado.");
        if (patient.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese paciente.");

        var email = request.Email.Trim().ToLowerInvariant();
        var existing = await _unitOfWork.Patients.GetByEmailAsync(tenantId, email);
        if (existing is not null && existing.Id != id)
            throw new InvalidOperationException("Ya existe un paciente con ese email en el tenant.");

        patient.FirstName = request.FirstName.Trim();
        patient.LastName = request.LastName.Trim();
        patient.Email = email;
        patient.Phone = request.Phone?.Trim();
        patient.DateOfBirth = request.DateOfBirth;
        patient.ProfilePhotoUrl = request.ProfilePhotoUrl;
        patient.Notes = request.Notes;
        patient.Status = request.Status;
        patient.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Patients.UpdateAsync(patient);
        await _activityService.RecordEntityAsync(tenantId, "update_patient", "Patient", patient.Id.ToString(), email);
        await _unitOfWork.SaveChangesAsync();

        return await WithFlagsAsync(tenantId, patient.ToDto());
    }

    public async Task DeleteAsync(Guid tenantId, Guid id)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Paciente no encontrado.");
        if (patient.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese paciente.");

        await _unitOfWork.Patients.DeleteAsync(patient);
        await _unitOfWork.SaveChangesAsync();
    }

    /// <summary>Invita (o reenvía) con rol Patient usando la lógica compartida de Usuarios.</summary>
    private async Task<string> InviteInternalAsync(Guid tenantId, Guid actorId, string email)
    {
        if (!InvitationDispatcher.IsValidEmail(email))
            return PatientInvitationStatus.None;

        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId)
            ?? throw new KeyNotFoundException("Tenant no encontrado.");

        var outcome = await _invitations.InviteOrResendAsync(tenant, email, UserRole.Patient, actorId);
        return outcome switch
        {
            InvitationOutcome.Sent => PatientInvitationStatus.Sent,
            InvitationOutcome.Resent => PatientInvitationStatus.Resent,
            InvitationOutcome.AlreadyMember => PatientInvitationStatus.AlreadyMember,
            _ => PatientInvitationStatus.None
        };
    }

    private async Task<PatientDto> WithFlagsAsync(Guid tenantId, PatientDto dto)
    {
        await FillAccountFlagsAsync(tenantId, [dto]);
        return dto;
    }

    /// <summary>hasAccount / pendingInvitation para un lote de pacientes: 2 consultas, sin N+1.</summary>
    private async Task FillAccountFlagsAsync(Guid tenantId, IReadOnlyCollection<PatientDto> dtos)
    {
        var emails = dtos
            .Select(d => d.Email)
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (emails.Count == 0)
            return;

        var withAccount = await _unitOfWork.Users.GetEmailsWithAccountAsync(tenantId, emails);
        var withPending = await _unitOfWork.Invitations.GetEmailsWithPendingInvitationAsync(tenantId, emails);

        foreach (var dto in dtos)
        {
            dto.HasAccount = withAccount.Contains(dto.Email);
            dto.PendingInvitation = withPending.Contains(dto.Email);
        }
    }
}

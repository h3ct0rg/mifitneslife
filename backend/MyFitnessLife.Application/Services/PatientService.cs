using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Application.Mapping;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class PatientService : IPatientService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITenantActivityService _activityService;

    public PatientService(IUnitOfWork unitOfWork, ITenantActivityService activityService)
    {
        _unitOfWork = unitOfWork;
        _activityService = activityService;
    }

    public async Task<PagedResult<PatientDto>> GetPagedAsync(
        Guid tenantId,
        string? search = null,
        int page = 1,
        int pageSize = 20)
    {
        var items = await _unitOfWork.Patients.GetByTenantAsync(tenantId, search, page, pageSize);
        var total = await _unitOfWork.Patients.CountByTenantAsync(tenantId, search);

        return new PagedResult<PatientDto>
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = items.Select(p => p.ToDto())
        };
    }

    public async Task<PatientDto> GetByIdAsync(Guid tenantId, Guid id)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Paciente no encontrado.");
        if (patient.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese paciente.");

        return patient.ToDto();
    }

    public async Task<PatientDto> CreateAsync(Guid tenantId, CreatePatientRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
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

        return patient.ToDto();
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

        return patient.ToDto();
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
}
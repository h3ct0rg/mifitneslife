using MyFitnessLife.Application.DTOs.PatientPhotos;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class PatientPhotoService : IPatientPhotoService
{
    private readonly IUnitOfWork _unitOfWork;

    public PatientPhotoService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<PatientPhotoDto>> GetByPatientAsync(Guid tenantId, Guid patientId)
    {
        await EnsurePatientAsync(tenantId, patientId);
        var photos = await _unitOfWork.PatientPhotos.GetByPatientAsync(patientId);
        return photos.Select(p => new PatientPhotoDto
        {
            Id = p.Id,
            PatientId = p.PatientId,
            FileName = p.FileName,
            TakenAt = p.TakenAt
        });
    }

    public async Task<PatientPhotoDto> CreateAsync(Guid tenantId, Guid patientId, string fileName, DateTime takenAt)
    {
        await EnsurePatientAsync(tenantId, patientId);

        var photo = new PatientPhoto
        {
            TenantId = tenantId,
            PatientId = patientId,
            FileName = fileName,
            TakenAt = takenAt == default ? DateTime.UtcNow : takenAt
        };

        await _unitOfWork.PatientPhotos.AddAsync(photo);
        await _unitOfWork.SaveChangesAsync();

        return new PatientPhotoDto
        {
            Id = photo.Id,
            PatientId = photo.PatientId,
            FileName = photo.FileName,
            TakenAt = photo.TakenAt
        };
    }

    public async Task DeleteAsync(Guid tenantId, Guid patientId, Guid id)
    {
        await EnsurePatientAsync(tenantId, patientId);
        var photo = await _unitOfWork.PatientPhotos.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Foto no encontrada.");
        if (photo.PatientId != patientId || photo.TenantId != tenantId)
            throw new UnauthorizedAccessException("Acceso denegado a la foto.");

        await _unitOfWork.PatientPhotos.DeleteAsync(photo);
        await _unitOfWork.SaveChangesAsync();
    }

    private async Task EnsurePatientAsync(Guid tenantId, Guid patientId)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(patientId)
            ?? throw new KeyNotFoundException("Paciente no encontrado.");
        if (patient.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese paciente.");
    }
}
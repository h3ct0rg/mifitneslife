using AutoMapper;
using MyFitnessLife.Application.DTOs.Measurements;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.DTOs.Users;
using MyFitnessLife.Domain.Entities;

namespace MyFitnessLife.Application.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<ApplicationUser, UserListItemDto>()
            .ForMember(d => d.Role, o => o.MapFrom(s => s.Role.ToString()))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()));

        CreateMap<Patient, PatientDto>()
            .ForMember(d => d.FullName, o => o.MapFrom(s => s.FullName))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()));

        CreateMap<CreateMeasurementRequest, Measurement>()
            .ForMember(d => d.Id, o => o.Ignore())
            .ForMember(d => d.CreatedAt, o => o.Ignore())
            .ForMember(d => d.UpdatedAt, o => o.Ignore())
            .ForMember(d => d.TenantId, o => o.Ignore())
            .ForMember(d => d.PatientId, o => o.Ignore())
            .ForMember(d => d.VisitDate, o => o.Ignore())
            .ForMember(d => d.Patient, o => o.Ignore());

        CreateMap<UpdateMeasurementRequest, Measurement>()
            .ForMember(d => d.Id, o => o.Ignore())
            .ForMember(d => d.CreatedAt, o => o.Ignore())
            .ForMember(d => d.TenantId, o => o.Ignore())
            .ForMember(d => d.PatientId, o => o.Ignore())
            .ForMember(d => d.VisitDate, o => o.Ignore())
            .ForMember(d => d.Patient, o => o.Ignore());

        CreateMap<Measurement, MeasurementDto>()
            .ForMember(d => d.CreatedAt, o => o.MapFrom(s => s.CreatedAt));
    }
}
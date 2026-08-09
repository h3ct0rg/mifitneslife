using AutoMapper;
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
    }
}
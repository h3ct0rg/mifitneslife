using AutoMapper;
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
    }
}
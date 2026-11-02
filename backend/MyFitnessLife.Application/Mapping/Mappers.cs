using MyFitnessLife.Application.DTOs.Appointments;
using MyFitnessLife.Application.DTOs.Measurements;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.DTOs.Users;
using MyFitnessLife.Domain.Entities;

namespace MyFitnessLife.Application.Mapping;

public static class Mappers
{
    public static UserListItemDto ToUserListItem(this ApplicationUser user)
        => new()
        {
            Id = user.Id,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Email = user.Email ?? string.Empty,
            Role = user.Role.ToString(),
            Status = user.Status.ToString(),
            TenantId = user.TenantId,
            LastLoginAt = user.LastLoginAt
        };

    public static ProfessionalDto ToProfessionalDto(this ApplicationUser user)
        => new()
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            Role = user.Role.ToString()
        };

    public static PatientDto ToDto(this Patient patient)
        => new()
        {
            Id = patient.Id,
            TenantId = patient.TenantId,
            FirstName = patient.FirstName,
            LastName = patient.LastName,
            FullName = patient.FullName,
            Email = patient.Email,
            Phone = patient.Phone,
            DateOfBirth = patient.DateOfBirth,
            ProfilePhotoUrl = patient.ProfilePhotoUrl,
            Notes = patient.Notes,
            Status = patient.Status.ToString(),
            CreatedAt = patient.CreatedAt
        };

    public static Measurement ToEntity(this CreateMeasurementRequest request)
        => new()
        {
            VisitDate = request.VisitDate,
            WeightKg = request.WeightKg,
            HeightCm = request.HeightCm,
            BodyFatPct = request.BodyFatPct,
            MuscleMassKg = request.MuscleMassKg,
            BoneMassKg = request.BoneMassKg,
            BodyWaterPct = request.BodyWaterPct,
            BasalMetabolism = request.BasalMetabolism,
            ChestCm = request.ChestCm,
            WaistCm = request.WaistCm,
            HipCm = request.HipCm,
            ArmCm = request.ArmCm,
            ForearmCm = request.ForearmCm,
            ThighCm = request.ThighCm,
            CalfCm = request.CalfCm,
            NeckCm = request.NeckCm,
            HeartRateBpm = request.HeartRateBpm,
            SystolicMmHg = request.SystolicMmHg,
            DiastolicMmHg = request.DiastolicMmHg,
            OxygenSaturationPct = request.OxygenSaturationPct,
            RespiratoryRate = request.RespiratoryRate,
            TemperatureC = request.TemperatureC,
            Notes = request.Notes
        };

    public static void Apply(this UpdateMeasurementRequest request, Measurement measurement)
    {
        measurement.VisitDate = request.VisitDate;
        measurement.WeightKg = request.WeightKg;
        measurement.HeightCm = request.HeightCm;
        measurement.BodyFatPct = request.BodyFatPct;
        measurement.MuscleMassKg = request.MuscleMassKg;
        measurement.BoneMassKg = request.BoneMassKg;
        measurement.BodyWaterPct = request.BodyWaterPct;
        measurement.BasalMetabolism = request.BasalMetabolism;
        measurement.ChestCm = request.ChestCm;
        measurement.WaistCm = request.WaistCm;
        measurement.HipCm = request.HipCm;
        measurement.ArmCm = request.ArmCm;
        measurement.ForearmCm = request.ForearmCm;
        measurement.ThighCm = request.ThighCm;
        measurement.CalfCm = request.CalfCm;
        measurement.NeckCm = request.NeckCm;
        measurement.HeartRateBpm = request.HeartRateBpm;
        measurement.SystolicMmHg = request.SystolicMmHg;
        measurement.DiastolicMmHg = request.DiastolicMmHg;
        measurement.OxygenSaturationPct = request.OxygenSaturationPct;
        measurement.RespiratoryRate = request.RespiratoryRate;
        measurement.TemperatureC = request.TemperatureC;
        measurement.Notes = request.Notes;
    }

    public static MeasurementDto ToDto(this Measurement measurement)
        => new()
        {
            Id = measurement.Id,
            PatientId = measurement.PatientId,
            VisitDate = measurement.VisitDate,
            WeightKg = measurement.WeightKg,
            HeightCm = measurement.HeightCm,
            BodyFatPct = measurement.BodyFatPct,
            MuscleMassKg = measurement.MuscleMassKg,
            BoneMassKg = measurement.BoneMassKg,
            BodyWaterPct = measurement.BodyWaterPct,
            BasalMetabolism = measurement.BasalMetabolism,
            ChestCm = measurement.ChestCm,
            WaistCm = measurement.WaistCm,
            HipCm = measurement.HipCm,
            ArmCm = measurement.ArmCm,
            ForearmCm = measurement.ForearmCm,
            ThighCm = measurement.ThighCm,
            CalfCm = measurement.CalfCm,
            NeckCm = measurement.NeckCm,
            HeartRateBpm = measurement.HeartRateBpm,
            SystolicMmHg = measurement.SystolicMmHg,
            DiastolicMmHg = measurement.DiastolicMmHg,
            OxygenSaturationPct = measurement.OxygenSaturationPct,
            RespiratoryRate = measurement.RespiratoryRate,
            TemperatureC = measurement.TemperatureC,
            Notes = measurement.Notes,
            CreatedAt = measurement.CreatedAt
        };

    public static Appointment ToEntity(this CreateAppointmentRequest request)
        => new()
        {
            PatientId = request.PatientId,
            ProfessionalId = request.ProfessionalId,
            DietId = request.DietId,
            StartAt = request.StartAt,
            EndAt = request.EndAt,
            Title = request.Title,
            Notes = request.Notes
        };

    public static void Apply(this UpdateAppointmentRequest request, Appointment appointment)
    {
        appointment.PatientId = request.PatientId;
        appointment.ProfessionalId = request.ProfessionalId;
        appointment.DietId = request.DietId;
        appointment.StartAt = request.StartAt;
        appointment.EndAt = request.EndAt;
        appointment.Title = request.Title;
        appointment.Notes = request.Notes;
    }
}
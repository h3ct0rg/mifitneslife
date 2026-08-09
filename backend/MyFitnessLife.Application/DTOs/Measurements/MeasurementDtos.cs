namespace MyFitnessLife.Application.DTOs.Measurements;

public class CreateMeasurementRequest
{
    public DateTime VisitDate { get; set; } = DateTime.UtcNow;

    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? BodyFatPct { get; set; }
    public decimal? MuscleMassKg { get; set; }
    public decimal? BoneMassKg { get; set; }
    public decimal? BodyWaterPct { get; set; }
    public decimal? BasalMetabolism { get; set; }

    public decimal? ChestCm { get; set; }
    public decimal? WaistCm { get; set; }
    public decimal? HipCm { get; set; }
    public decimal? ArmCm { get; set; }
    public decimal? ForearmCm { get; set; }
    public decimal? ThighCm { get; set; }
    public decimal? CalfCm { get; set; }
    public decimal? NeckCm { get; set; }

    public decimal? HeartRateBpm { get; set; }
    public decimal? SystolicMmHg { get; set; }
    public decimal? DiastolicMmHg { get; set; }
    public decimal? OxygenSaturationPct { get; set; }
    public decimal? RespiratoryRate { get; set; }
    public decimal? TemperatureC { get; set; }

    public string? Notes { get; set; }
}

public class UpdateMeasurementRequest : CreateMeasurementRequest
{
}

public class MeasurementDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public DateTime VisitDate { get; set; }

    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? BodyFatPct { get; set; }
    public decimal? MuscleMassKg { get; set; }
    public decimal? BoneMassKg { get; set; }
    public decimal? BodyWaterPct { get; set; }
    public decimal? BasalMetabolism { get; set; }

    public decimal? ChestCm { get; set; }
    public decimal? WaistCm { get; set; }
    public decimal? HipCm { get; set; }
    public decimal? ArmCm { get; set; }
    public decimal? ForearmCm { get; set; }
    public decimal? ThighCm { get; set; }
    public decimal? CalfCm { get; set; }
    public decimal? NeckCm { get; set; }

    public decimal? HeartRateBpm { get; set; }
    public decimal? SystolicMmHg { get; set; }
    public decimal? DiastolicMmHg { get; set; }
    public decimal? OxygenSaturationPct { get; set; }
    public decimal? RespiratoryRate { get; set; }
    public decimal? TemperatureC { get; set; }

    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }

    // Calculados
    public decimal? IMC { get; set; }
    public string IMCRange { get; set; } = "—";
    public decimal? WaistHipRatio { get; set; }
    public string WaistHipRange { get; set; } = "—";
    public decimal? IAC { get; set; }
    public string IACRange { get; set; } = "—";
}

public class MeasurementIndexDto
{
    public decimal? IMC { get; set; }
    public string IMCRange { get; set; } = "—";
    public decimal? WaistHipRatio { get; set; }
    public string WaistHipRange { get; set; } = "—";
    public decimal? IAC { get; set; }
    public string IACRange { get; set; } = "—";
}

public class MeasurementDeltaDto
{
    public string Label { get; set; } = string.Empty;
    public decimal? First { get; set; }
    public decimal? Last { get; set; }
    public decimal? Change { get; set; }
    public string Unit { get; set; } = string.Empty;
}

public class MeasurementDashboardDto
{
    public MeasurementIndexDto? LatestIndexes { get; set; }
    public IEnumerable<MeasurementSeriesPointDto> WeightSeries { get; set; } = [];
    public IEnumerable<MeasurementSeriesPointDto> IMCSeries { get; set; } = [];
    public IEnumerable<MeasurementSeriesPointDto> BodyFatSeries { get; set; } = [];
    public IEnumerable<MeasurementSeriesPointDto> WaistSeries { get; set; } = [];
    public IEnumerable<MeasurementDeltaDto> Deltas { get; set; } = [];
}

public class MeasurementSeriesPointDto
{
    public DateTime Date { get; set; }
    public decimal? Value { get; set; }
}
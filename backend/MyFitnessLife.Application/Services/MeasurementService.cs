using AutoMapper;
using MyFitnessLife.Application.DTOs.Measurements;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class MeasurementService : IMeasurementService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public MeasurementService(IUnitOfWork unitOfWork, IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<PagedResult<MeasurementDto>> GetByPatientAsync(
        Guid tenantId,
        Guid patientId,
        int page = 1,
        int pageSize = 20)
    {
        await EnsurePatientAsync(tenantId, patientId);

        var items = await _unitOfWork.Measurements.GetByPatientAsync(patientId, page, pageSize);
        var total = await _unitOfWork.Measurements.CountByPatientAsync(patientId);

        return new PagedResult<MeasurementDto>
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = items.Select(m => ToDto(m))
        };
    }

    public async Task<MeasurementDto> GetByIdAsync(Guid tenantId, Guid patientId, Guid id)
    {
        await EnsurePatientAsync(tenantId, patientId);
        var measurement = await _unitOfWork.Measurements.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Medición no encontrada.");
        if (measurement.PatientId != patientId)
            throw new KeyNotFoundException("Medición no encontrada.");

        return ToDto(measurement);
    }

    public async Task<MeasurementDto> CreateAsync(Guid tenantId, Guid patientId, CreateMeasurementRequest request)
    {
        await EnsurePatientAsync(tenantId, patientId);

        var measurement = _mapper.Map<Measurement>(request);
        measurement.PatientId = patientId;
        measurement.TenantId = tenantId;
        measurement.VisitDate = request.VisitDate == default ? DateTime.UtcNow : request.VisitDate;

        await _unitOfWork.Measurements.AddAsync(measurement);
        await _unitOfWork.SaveChangesAsync();

        return ToDto(measurement);
    }

    public async Task<MeasurementDto> UpdateAsync(Guid tenantId, Guid patientId, Guid id, UpdateMeasurementRequest request)
    {
        await EnsurePatientAsync(tenantId, patientId);
        var measurement = await _unitOfWork.Measurements.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Medición no encontrada.");
        if (measurement.PatientId != patientId)
            throw new KeyNotFoundException("Medición no encontrada.");

        _mapper.Map(request, measurement);
        measurement.VisitDate = request.VisitDate == default ? measurement.VisitDate : request.VisitDate;
        measurement.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Measurements.UpdateAsync(measurement);
        await _unitOfWork.SaveChangesAsync();

        return ToDto(measurement);
    }

    public async Task DeleteAsync(Guid tenantId, Guid patientId, Guid id)
    {
        await EnsurePatientAsync(tenantId, patientId);
        var measurement = await _unitOfWork.Measurements.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Medición no encontrada.");
        if (measurement.PatientId != patientId)
            throw new KeyNotFoundException("Medición no encontrada.");

        await _unitOfWork.Measurements.DeleteAsync(measurement);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<MeasurementDashboardDto> GetDashboardAsync(Guid tenantId, Guid patientId)
    {
        await EnsurePatientAsync(tenantId, patientId);

        var history = (await _unitOfWork.Measurements.GetHistoryAsync(patientId, 100)).ToList();
        var latest = history.LastOrDefault();

        var dashboard = new MeasurementDashboardDto
        {
            LatestIndexes = latest is null ? null : ComputeIndexes(latest),
            WeightSeries = history.Where(m => m.WeightKg.HasValue)
                .Select(m => new MeasurementSeriesPointDto { Date = m.VisitDate, Value = m.WeightKg }),
            IMCSeries = history.Where(m => m.WeightKg.HasValue && m.HeightCm.HasValue)
                .Select(m => new MeasurementSeriesPointDto { Date = m.VisitDate, Value = ComputeIndexes(m).IMC }),
            BodyFatSeries = history.Where(m => m.BodyFatPct.HasValue)
                .Select(m => new MeasurementSeriesPointDto { Date = m.VisitDate, Value = m.BodyFatPct }),
            WaistSeries = history.Where(m => m.WaistCm.HasValue)
                .Select(m => new MeasurementSeriesPointDto { Date = m.VisitDate, Value = m.WaistCm }),
            Deltas = ComputeDeltas(history)
        };

        return dashboard;
    }

    public Task<MeasurementIndexDto> ComputeIndexesAsync(Measurement measurement)
        => Task.FromResult(ComputeIndexes(measurement));

    private MeasurementDto ToDto(Measurement measurement)
    {
        var dto = _mapper.Map<MeasurementDto>(measurement);
        var indexes = ComputeIndexes(measurement);
        dto.IMC = indexes.IMC;
        dto.IMCRange = indexes.IMCRange;
        dto.WaistHipRatio = indexes.WaistHipRatio;
        dto.WaistHipRange = indexes.WaistHipRange;
        dto.IAC = indexes.IAC;
        dto.IACRange = indexes.IACRange;
        return dto;
    }

    private MeasurementIndexDto ComputeIndexes(Measurement m)
    {
        // IMC = peso(kg) / altura(m)^2
        decimal? imc = null;
        string imcRange = "—";
        if (m.WeightKg.HasValue && m.HeightCm.HasValue && m.HeightCm > 0)
        {
            var heightM = m.HeightCm.Value / 100m;
            imc = Math.Round(m.WeightKg.Value / (heightM * heightM), 1);
            imcRange = imc switch
            {
                < 18.5m => "Bajo peso",
                < 25m => "Normal",
                < 30m => "Sobrepeso",
                _ => "Obesidad"
            };
        }

        // Cintura-cadera
        decimal? whr = null;
        string whrRange = "—";
        if (m.WaistCm.HasValue && m.HipCm.HasValue && m.HipCm > 0)
        {
            whr = Math.Round(m.WaistCm.Value / m.HipCm.Value, 2);
            whrRange = whr switch
            {
                <= 0.85m => "Bajo riesgo",
                <= 0.90m => "Riesgo moderado",
                _ => "Riesgo alto"
            };
        }

        // IAC = (cadera(cm) / altura(m)^1.5) - 18
        decimal? iac = null;
        string iacRange = "—";
        if (m.HipCm.HasValue && m.HeightCm.HasValue && m.HeightCm > 0)
        {
            var heightM = m.HeightCm.Value / 100m;
            iac = Math.Round(m.HipCm.Value / (decimal)Math.Pow((double)heightM, 1.5) - 18, 1);
            iacRange = iac switch
            {
                < 21 => "Excelente",
                < 26 => "Bueno",
                < 32 => "Normal",
                < 38 => "Alto",
                _ => "Muy alto"
            };
        }

        return new MeasurementIndexDto { IMC = imc, IMCRange = imcRange, WaistHipRatio = whr, WaistHipRange = whrRange, IAC = iac, IACRange = iacRange };
    }

    private IEnumerable<MeasurementDeltaDto> ComputeDeltas(List<Measurement> history)
    {
        if (history.Count < 2) return [];

        var first = history.First();
        var last = history.Last();

        decimal? Delta(string label, decimal? a, decimal? b, string unit)
        {
            if (!a.HasValue || !b.HasValue) return null;
            var change = Math.Round(b.Value - a.Value, 1);
            return change;
        }

        return new[]
        {
            new MeasurementDeltaDto { Label = "Peso", First = first.WeightKg, Last = last.WeightKg, Change = Delta("peso", first.WeightKg, last.WeightKg, "kg"), Unit = "kg" },
            new MeasurementDeltaDto { Label = "Cintura", First = first.WaistCm, Last = last.WaistCm, Change = Delta("cintura", first.WaistCm, last.WaistCm, "cm"), Unit = "cm" },
            new MeasurementDeltaDto { Label = "Cadera", First = first.HipCm, Last = last.HipCm, Change = Delta("cadera", first.HipCm, last.HipCm, "cm"), Unit = "cm" },
            new MeasurementDeltaDto { Label = "% grasa corporal", First = first.BodyFatPct, Last = last.BodyFatPct, Change = Delta("bf", first.BodyFatPct, last.BodyFatPct, "%"), Unit = "%" },
        }.Where(d => d.Change.HasValue);
    }

    private async Task EnsurePatientAsync(Guid tenantId, Guid patientId)
    {
        var patient = await _unitOfWork.Patients.GetByIdAsync(patientId)
            ?? throw new KeyNotFoundException("Paciente no encontrado.");
        if (patient.TenantId != tenantId)
            throw new UnauthorizedAccessException("No tiene acceso a ese paciente.");
    }
}
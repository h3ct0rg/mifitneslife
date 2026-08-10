namespace MyFitnessLife.Application.DTOs.PatientPhotos;

public class PatientPhotoDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public DateTime TakenAt { get; set; }
}
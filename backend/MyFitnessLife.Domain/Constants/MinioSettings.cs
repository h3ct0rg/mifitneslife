namespace MyFitnessLife.Domain.Constants;

public class MinioSettings
{
    public string Endpoint { get; set; } = string.Empty;
    public string AccessKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public string BucketName { get; set; } = string.Empty;
    public string ImageExerciseBucket { get; set; } = string.Empty;
    public string VideoExerciseBucket { get; set; } = string.Empty;
    public bool UseSSL { get; set; }
}
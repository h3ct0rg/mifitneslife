namespace MyFitnessLife.Application.Interfaces;

public interface IMinioService
{
    Task<string> UploadImageAsync(string fileName, Stream fileStream);
    Task DeleteImageAsync(string fileName);
    Task<(Stream Stream, string ContentType)> GetImageAsync(string fileName);
    Task<string> UploadFileAsync(string bucket, string fileName, Stream fileStream, string contentType);
    Task<(Stream Stream, string ContentType)> GetFileAsync(string bucket, string fileName);
    Task DeleteFileAsync(string bucket, string fileName);
}
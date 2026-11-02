using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Constants;

namespace MyFitnessLife.Infrastructure.Services;

public class MinioService : IMinioService
{
    private readonly MinioSettings _settings;
    private readonly IMinioClient _minioClient;

    public MinioService(IOptions<MinioSettings> settings, IMinioClient minioClient)
    {
        _settings = settings.Value;
        _minioClient = minioClient;
    }

    public async Task<string> UploadImageAsync(string fileName, Stream fileStream)
    {
        var bucket = _settings.BucketName.ToLowerInvariant();
        await EnsureBucketAsync(bucket);

        if (fileStream.CanSeek)
            fileStream.Position = 0;

        var putObjectArgs = new PutObjectArgs()
            .WithBucket(bucket)
            .WithObject(fileName)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.Length)
            .WithContentType(GetContentType(fileName));

        await _minioClient.PutObjectAsync(putObjectArgs);

        return fileName;
    }

    public async Task DeleteImageAsync(string fileName)
    {
        var bucket = _settings.BucketName.ToLowerInvariant();
        var args = new RemoveObjectArgs()
            .WithBucket(bucket)
            .WithObject(fileName);
        await _minioClient.RemoveObjectAsync(args);
    }

    public async Task<(Stream Stream, string ContentType)> GetImageAsync(string fileName)
    {
        var bucket = _settings.BucketName.ToLowerInvariant();
        var memoryStream = new MemoryStream();
        var args = new GetObjectArgs()
            .WithBucket(bucket)
            .WithObject(fileName)
            .WithCallbackStream(stream => stream.CopyTo(memoryStream));
        await _minioClient.GetObjectAsync(args);
        memoryStream.Position = 0;
        return (memoryStream, GetContentType(fileName));
    }

    public async Task<string> UploadFileAsync(string bucket, string fileName, Stream fileStream, string contentType)
    {
        bucket = bucket.ToLowerInvariant();
        await EnsureBucketAsync(bucket);
        if (fileStream.CanSeek) fileStream.Position = 0;
        var args = new PutObjectArgs().WithBucket(bucket).WithObject(fileName).WithStreamData(fileStream).WithObjectSize(fileStream.Length).WithContentType(contentType);
        await _minioClient.PutObjectAsync(args);
        return fileName;
    }

    public async Task<(Stream Stream, string ContentType)> GetFileAsync(string bucket, string fileName)
    {
        bucket = bucket.ToLowerInvariant();
        var memoryStream = new MemoryStream();
        var args = new GetObjectArgs().WithBucket(bucket).WithObject(fileName).WithCallbackStream(stream => stream.CopyTo(memoryStream));
        await _minioClient.GetObjectAsync(args);
        memoryStream.Position = 0;
        return (memoryStream, GetContentType(fileName));
    }

    public async Task DeleteFileAsync(string bucket, string fileName)
    {
        bucket = bucket.ToLowerInvariant();
        var args = new RemoveObjectArgs().WithBucket(bucket).WithObject(fileName);
        await _minioClient.RemoveObjectAsync(args);
    }

    private static string GetContentType(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".svg" => "image/svg+xml",
            ".xml" => "application/xml",
            ".json" => "application/json",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream"
        };
    }

    private async Task EnsureBucketAsync(string bucket)
    {
        try
        {
            var existsArgs = new BucketExistsArgs().WithBucket(bucket);
            if (await _minioClient.BucketExistsAsync(existsArgs))
                return;

            await _minioClient.MakeBucketAsync(new MakeBucketArgs().WithBucket(bucket));

            var policy = $@"{{
                ""Version"": ""2012-10-17"",
                ""Statement"": [
                    {{
                        ""Effect"": ""Allow"",
                        ""Principal"": ""*"",
                        ""Action"": [ ""s3:GetObject"" ],
                        ""Resource"": [ ""arn:aws:s3:::{bucket}/*"" ]
                    }}
                ]
            }}";

            await _minioClient.SetPolicyAsync(new SetPolicyArgs()
                .WithBucket(bucket)
                .WithPolicy(policy));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Minio] Advertencia al configurar bucket '{bucket}': {ex.Message}");
        }
    }
}
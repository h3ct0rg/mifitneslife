namespace MyFitnessLife.Application.Exceptions;

/// <summary>Autenticado pero sin permiso para la operación. Se traduce a HTTP 403 con {error}.</summary>
public class ForbiddenException : Exception
{
    public ForbiddenException(string message) : base(message)
    {
    }
}

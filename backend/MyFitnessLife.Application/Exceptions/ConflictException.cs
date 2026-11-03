namespace MyFitnessLife.Application.Exceptions;

/// <summary>
/// Conflicto con el estado actual (p. ej. recurso duplicado). Se traduce a HTTP 409.
/// Hereda de InvalidOperationException para que, si no se captura, siga siendo un 400.
/// </summary>
public class ConflictException : InvalidOperationException
{
    public ConflictException(string message) : base(message)
    {
    }
}

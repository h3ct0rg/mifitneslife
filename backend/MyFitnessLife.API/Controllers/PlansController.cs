using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.Interfaces;

namespace MyFitnessLife.API.Controllers;

/// <summary>Catálogo público de planes para la landing (anónimo, sin datos internos).</summary>
[ApiController]
[Route("api/plans")]
[AllowAnonymous]
public class PlansController : ControllerBase
{
    private readonly ISubscriptionService _subscriptionService;

    public PlansController(ISubscriptionService subscriptionService) => _subscriptionService = subscriptionService;

    /// <summary>Planes activos de pago (por SortOrder) y días de prueba gratis.</summary>
    [HttpGet]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    [ProducesResponseType(typeof(PublicPlansDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get()
        => Ok(await _subscriptionService.GetPublicPlansAsync());
}

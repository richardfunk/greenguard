using GreenGuard.WebApi.Models;
using GreenGuard.WebApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace GreenGuard.WebApi.Controllers;

[ApiController]
[Route("api/anomalies")]
public class AnomaliesController(IDataStore store) : ControllerBase
{
    // GET /api/anomalies
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Anomaly>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<Anomaly>> GetRecent()
    {
        return Ok(store.GetRecentAnomalies(20));
    }
}

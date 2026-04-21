using System.Text.Json;
using GreenGuard.WebApi.Models;
using GreenGuard.WebApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace GreenGuard.WebApi.Controllers;

[ApiController]
[Route("api/readings")]
public class ReadingsController(IDataStore store, ReadingIngestionService ingestion) : ControllerBase
{
    private static readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet("latest")]
    [ProducesResponseType(typeof(SensorReading), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<SensorReading> GetLatest()
    {
        var reading = store.GetLatest();
        return reading is null ? NotFound() : Ok(reading);
    }
    
    [HttpGet]
    [ProducesResponseType(typeof(SensorReading), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<SensorReading> Get()
    {
        return Ok(store.GetRecent(20));
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] JsonElement body)
    {
        List<SensorReading> readings;

        switch (body.ValueKind)
        {
            case JsonValueKind.Array:
                readings = body.Deserialize<List<SensorReading>>(_jsonOptions) ?? [];
                break;
            case JsonValueKind.Object:
                var single = body.Deserialize<SensorReading>(_jsonOptions);
                readings = single is null ? [] : [single];
                break;
            default:
                return BadRequest("Body must be a SensorReading object or array.");
        }

        if (readings.Count == 0)
            return BadRequest("No readings provided.");

        await ingestion.IngestAsync(readings);
        return Ok(new { accepted = readings.Count });
    }
}

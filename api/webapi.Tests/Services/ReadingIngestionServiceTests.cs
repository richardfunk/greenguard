using GreenGuard.WebApi.Hubs;
using GreenGuard.WebApi.Models;
using GreenGuard.WebApi.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace GreenGuard.WebApi.Tests.Services;

public class ReadingIngestionServiceTests
{
    private readonly IDataStore _store = Substitute.For<IDataStore>();
    private readonly IAnomalyDetector _detector = Substitute.For<IAnomalyDetector>();
    private readonly IClientProxy _clientProxy = Substitute.For<IClientProxy>();
    private readonly ReadingIngestionService _service;

    public ReadingIngestionServiceTests()
    {
        var clients = Substitute.For<IHubClients>();
        clients.All.Returns(_clientProxy);

        var hub = Substitute.For<IHubContext<SensorHub>>();
        hub.Clients.Returns(clients);

        _detector.Detect(Arg.Any<SensorReading>()).Returns([]);
        _service = new ReadingIngestionService(_store, _detector, hub, NullLogger<ReadingIngestionService>.Instance);
    }

    private static SensorReading NewReading() => new()
    {
        Id = Guid.NewGuid(),
        SequenceNumber = 1,
        Timestamp = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        Temperature = 22,
        Humidity = 60,
        Co2Ppm = 600
    };

    // ── SignalR broadcasting ──────────────────────────────────────────────────────

    [Fact]
    public async Task IngestAsync_BroadcastsReceiveReadingForEachReading()
    {
        var readings = new[] { NewReading(), NewReading() };

        await _service.IngestAsync(readings);

        await _clientProxy.Received(2).SendCoreAsync(
            "ReceiveReading",
            Arg.Any<object?[]>(),
            Arg.Any<CancellationToken>());
    }

    // ── Anomaly handling ──────────────────────────────────────────────────────────
    
    [Fact]
    public async Task IngestAsync_WhenAnomalyDetected_BroadcastsReceiveAnomaly()
    {
        var anomaly = new Anomaly { Id = Guid.NewGuid(), DetectedAt = DateTime.UtcNow, SensorType = "Temperature", Value = 40, ZScore = 5m, Reason = "spike" };
        _detector.Detect(Arg.Any<SensorReading>()).Returns([anomaly]);

        await _service.IngestAsync([NewReading()]);

        await _clientProxy.Received(1).SendCoreAsync(
            "ReceiveAnomaly",
            Arg.Any<object?[]>(),
            Arg.Any<CancellationToken>());
    }
}

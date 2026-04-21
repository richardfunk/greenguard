using GreenGuard.WebApi.Models;
using GreenGuard.WebApi.Services;
using NSubstitute;

namespace GreenGuard.WebApi.Tests.Services;

public class AnomalyDetectionServiceTests
{
    // Window: temps [20,21,22,23,24] → mean=22, stdDev=√2≈1.414
    // Spike at 40 → Z≈12.7 (anomaly), normal at 22.5 → Z≈0.35 (not anomaly)
    private static readonly DateTime Ts = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static SensorReading Reading(decimal temp = 22, decimal humidity = 60, int co2 = 600)
        => new() { Id = Guid.NewGuid(), SequenceNumber = 1, Timestamp = Ts, Temperature = temp, Humidity = humidity, Co2Ppm = co2 };

    private static IReadOnlyList<SensorReading> BuildWindow(int size, decimal temp = 22, decimal humidity = 60, int co2 = 600)
        => Enumerable.Range(0, size)
            .Select(i => Reading(temp + i - size / 2, humidity + i - size / 2, (int)(co2 + i - size / 2)))
            .ToList();

    private static (AnomalyDetectionService service, IDataStore store) Create(IReadOnlyList<SensorReading> window)
    {
        var store = Substitute.For<IDataStore>();
        store.GetRecent(Arg.Any<int>()).Returns(window);
        return (new AnomalyDetectionService(store), store);
    }

    // ── No anomaly ───────────────────────────────────────────────────────────────

    [Fact]
    public void Detect_NormalReading_ReturnsNoAnomalies()
    {
        var window = BuildWindow(5);
        var (service, _) = Create(window);

        Assert.Empty(service.Detect(Reading(temp: 22.5m, humidity: 60, co2: 600)));
    }
    
    
    // ── Sensor-specific anomalies ────────────────────────────────────────────────
    
    [Fact]
    public void Detect_MultipleSpikes_ReturnsOneAnomalyPerSensor()
    {
        var window = BuildWindow(5);
        var (service, _) = Create(window);

        var anomalies = service.Detect(Reading(temp: 40, humidity: 95, co2: 2000)).ToList();

        Assert.Equal(3, anomalies.Count);
        Assert.NotNull(anomalies.Find(x => x.SensorType == "Temperature"));
        Assert.NotNull(anomalies.Find(x => x.SensorType == "CO2"));
        Assert.NotNull(anomalies.Find(x => x.SensorType == "Humidity"));
    }
}

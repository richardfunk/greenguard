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

    // ── Minimum window ───────────────────────────────────────────────────────────

    [Fact]
    public void Detect_WhenWindowBelowMinSize_ReturnsEmpty()
    {
        var (service, _) = Create([Reading(), Reading()]);
        Assert.Empty(service.Detect(Reading()));
    }

    [Fact]
    public void Detect_WhenWindowAtMinSize_RunsDetection()
    {
        var window = BuildWindow(3);
        var (service, _) = Create(window);

        // Normal reading — no anomaly, but detection ran (no exception)
        Assert.Empty(service.Detect(Reading(temp: 22)));
    }

    // ── No anomaly ───────────────────────────────────────────────────────────────

    [Fact]
    public void Detect_NormalReading_ReturnsNoAnomalies()
    {
        var window = BuildWindow(5);
        var (service, _) = Create(window);

        Assert.Empty(service.Detect(Reading(temp: 22.5m, humidity: 60, co2: 600)));
    }

    [Fact]
    public void Detect_AllWindowValuesIdentical_ReturnsEmpty()
    {
        var window = Enumerable.Range(0, 10).Select(_ => Reading(22, 60, 600)).ToList();
        var (service, _) = Create(window);

        Assert.Empty(service.Detect(Reading(temp: 40)));
    }

    // ── Sensor-specific anomalies ────────────────────────────────────────────────

    [Fact]
    public void Detect_TemperatureSpike_ReturnsTemperatureAnomaly()
    {
        var window = BuildWindow(5);
        var (service, _) = Create(window);

        var anomalies = service.Detect(Reading(temp: 40)).ToList();

        Assert.Single(anomalies);
        Assert.Equal("Temperature", anomalies[0].SensorType);
    }

    [Fact]
    public void Detect_HumiditySpike_ReturnsHumidityAnomaly()
    {
        var window = BuildWindow(5, humidity: 60);
        var (service, _) = Create(window);

        var anomalies = service.Detect(Reading(humidity: 95)).ToList();

        Assert.Single(anomalies);
        Assert.Equal("Humidity", anomalies[0].SensorType);
    }

    [Fact]
    public void Detect_Co2Spike_ReturnsCo2Anomaly()
    {
        var window = BuildWindow(5, co2: 600);
        var (service, _) = Create(window);

        var anomalies = service.Detect(Reading(co2: 2000)).ToList();

        Assert.Single(anomalies);
        Assert.Equal("CO2", anomalies[0].SensorType);
    }

    [Fact]
    public void Detect_MultipleSpikes_ReturnsOneAnomalyPerSensor()
    {
        var window = BuildWindow(5);
        var (service, _) = Create(window);

        var anomalies = service.Detect(Reading(temp: 40, humidity: 95, co2: 2000)).ToList();

        Assert.Equal(3, anomalies.Count);
    }

    // ── Anomaly field correctness ─────────────────────────────────────────────────

    [Fact]
    public void Detect_Anomaly_HasCorrectFields()
    {
        var window = BuildWindow(5);
        var (service, _) = Create(window);
        var subject = Reading(temp: 40);

        var anomaly = service.Detect(subject).Single();

        Assert.NotEqual(Guid.Empty, anomaly.Id);
        Assert.Equal(subject.Timestamp, anomaly.DetectedAt);
        Assert.Equal(40m, anomaly.Value);
        Assert.True(anomaly.ZScore > 2.5m);
        Assert.NotEmpty(anomaly.Reason);
    }

    // ── Store interaction ─────────────────────────────────────────────────────────

    [Fact]
    public void Detect_FetchesWindowOf20FromStore()
    {
        var window = BuildWindow(5);
        var (service, store) = Create(window);

        service.Detect(Reading());

        store.Received(1).GetRecent(20);
    }
}

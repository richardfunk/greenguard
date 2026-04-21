using GreenGuard.WebApi.Models;
using GreenGuard.WebApi.Services;

namespace GreenGuard.WebApi.Tests.Services;

public class InMemoryDataStorageServiceTests
{
    private static readonly DateTime BaseTime = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static SensorReading Reading(int seq, DateTime timestamp, decimal temp = 22, decimal humidity = 60, int co2 = 600)
        => new() { Id = Guid.NewGuid(), SequenceNumber = seq, Timestamp = timestamp, Temperature = temp, Humidity = humidity, Co2Ppm = co2 };

    private static Anomaly Anomaly(DateTime detectedAt)
        => new() { Id = Guid.NewGuid(), DetectedAt = detectedAt, SensorType = "Temperature", Value = 38, ZScore = 3.5m, Reason = "test" };

    // ── GetLatest ────────────────────────────────────────────────────────────────

    [Fact]
    public void GetLatest_WhenEmpty_ReturnsNull()
    {
        var store = new InMemoryDataStorageService();
        Assert.Null(store.GetLatest());
    }

    [Fact]
    public void GetLatest_ReturnsReadingWithNewestTimestamp()
    {
        var store = new InMemoryDataStorageService();
        var older = Reading(1, BaseTime);
        var newer = Reading(2, BaseTime.AddMinutes(1));
        store.Add(older);
        store.Add(newer);

        Assert.Equal(newer.Id, store.GetLatest()!.Id);
    }

    [Fact]
    public void GetLatest_SameTimestamp_ReturnsHighestSequenceNumber()
    {
        var store = new InMemoryDataStorageService();
        var first  = Reading(1, BaseTime);
        var second = Reading(2, BaseTime);
        store.Add(first);
        store.Add(second);

        Assert.Equal(second.Id, store.GetLatest()!.Id);
    }

    // ── GetRecent ────────────────────────────────────────────────────────────────

    [Fact]
    public void GetRecent_ReturnsRequestedCountOldestFirst()
    {
        var store = new InMemoryDataStorageService();
        for (var i = 1; i <= 5; i++)
            store.Add(Reading(i, BaseTime.AddMinutes(i)));

        var result = store.GetRecent(3);

        Assert.Equal(3, result.Count);
        Assert.Equal(3, result[0].SequenceNumber);
        Assert.Equal(5, result[2].SequenceNumber);
    }

    [Fact]
    public void GetRecent_WhenCountExceedsTotal_ReturnsAll()
    {
        var store = new InMemoryDataStorageService();
        store.Add(Reading(1, BaseTime));
        store.Add(Reading(2, BaseTime.AddMinutes(1)));

        Assert.Equal(2, store.GetRecent(10).Count);
    }

    [Fact]
    public void GetRecent_Empty_ReturnsEmptyList()
    {
        var store = new InMemoryDataStorageService();
        Assert.Empty(store.GetRecent(5));
    }

    // ── AddAnomaly / GetRecentAnomalies ──────────────────────────────────────────

    [Fact]
    public void AddAnomaly_GetRecentAnomalies_RoundTrips()
    {
        var store   = new InMemoryDataStorageService();
        var anomaly = Anomaly(BaseTime);
        store.AddAnomaly(anomaly);

        var result = store.GetRecentAnomalies(20);

        Assert.Single(result);
        Assert.Equal(anomaly.Id, result[0].Id);
    }

    [Fact]
    public void GetRecentAnomalies_ReturnsAscendingByTimestamp()
    {
        var store  = new InMemoryDataStorageService();
        var older  = Anomaly(BaseTime);
        var newer  = Anomaly(BaseTime.AddMinutes(1));
        store.AddAnomaly(newer);
        store.AddAnomaly(older);

        var result = store.GetRecentAnomalies(20);

        Assert.Equal(older.Id, result[0].Id);
        Assert.Equal(newer.Id, result[1].Id);
    }

    [Fact]
    public void GetRecentAnomalies_ReturnsOnlyRequestedCount()
    {
        var store = new InMemoryDataStorageService();
        for (var i = 0; i < 10; i++)
            store.AddAnomaly(Anomaly(BaseTime.AddMinutes(i)));

        Assert.Equal(5, store.GetRecentAnomalies(5).Count);
    }

    [Fact]
    public void AddAnomaly_WhenExceedsCap_EvictsOldestByTimestamp()
    {
        var store   = new InMemoryDataStorageService();
        var oldest  = Anomaly(BaseTime.AddMinutes(-1));
        store.AddAnomaly(oldest);

        for (var i = 0; i < 20; i++)
            store.AddAnomaly(Anomaly(BaseTime.AddMinutes(i)));

        var result = store.GetRecentAnomalies(20);
        Assert.Equal(20, result.Count);
        Assert.DoesNotContain(result, a => a.Id == oldest.Id);
    }
}

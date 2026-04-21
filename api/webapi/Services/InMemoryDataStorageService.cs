using GreenGuard.WebApi.Models;

namespace GreenGuard.WebApi.Services;

/// <summary>
/// Thread-safe in-memory store for sensor readings and anomalies.
/// </summary>
public interface IDataStore
{
    SensorReading? GetLatest();
    void Add(SensorReading reading);
    /// <summary>Returns up to <paramref name="count"/> most recent readings, oldest first.</summary>
    IReadOnlyList<SensorReading> GetRecent(int count);
    IReadOnlyList<Anomaly> GetRecentAnomalies(int count = 20);
    void AddAnomaly(Anomaly anomaly);
}

public class InMemoryDataStorageService : IDataStore
{
    private readonly object _lock = new();
    
    private static readonly IComparer<SensorReading> ByTimestamp =
        Comparer<SensorReading>.Create((a, b) =>
        {
            var cmp = a.Timestamp.CompareTo(b.Timestamp);
            return cmp != 0 ? cmp : a.SequenceNumber.CompareTo(b.SequenceNumber);
        });

    // Store readings based on Timestamp and SequenceNumber.
    private readonly SortedSet<SensorReading> _readings = new(ByTimestamp);

    private static readonly IComparer<Anomaly> AnomalyByTimestamp =
        Comparer<Anomaly>.Create((a, b) =>
        {
            var cmp = a.DetectedAt.CompareTo(b.DetectedAt);
            return cmp != 0 ? cmp : a.Id.CompareTo(b.Id);
        });

    // Store anomalies based on Timestamp and Id.
    private readonly SortedSet<Anomaly> _anomalies = new(AnomalyByTimestamp);
    private const int MaxAnomalies = 20;

    public SensorReading? GetLatest()
    {
        lock (_lock)
        {
            return _readings.Count == 0 ? null : _readings.Max;
        }
    }

    public void Add(SensorReading reading)
    {
        lock (_lock)
        {
            _readings.Add(reading);
        }
    }

    public IReadOnlyList<SensorReading> GetRecent(int count)
    {
        lock (_lock)
        {
            return _readings.TakeLast(count).ToList();
        }
    }

    public IReadOnlyList<Anomaly> GetRecentAnomalies(int count)
    {
        lock (_lock)
        {
            return _anomalies.TakeLast(count).ToList();
        }
    }

    public void AddAnomaly(Anomaly anomaly)
    {
        lock (_lock)
        {
            _anomalies.Add(anomaly);
            while (_anomalies.Count > MaxAnomalies)
                _anomalies.Remove(_anomalies.Min!);
        }
    }
}
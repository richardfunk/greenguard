using GreenGuard.WebApi.Models;

namespace GreenGuard.WebApi.Services;

/// <summary>
/// Detects anomalies using a rolling Z-score calculated from the last
/// <see cref="WindowSize"/> readings stored in <see cref="IDataStore"/>.
///
/// A reading is flagged when |Z-score| > <see cref="ZScoreThreshold"/>.
///
/// Requires at least <see cref="MinWindowSize"/> readings in the window before
/// detection runs — returns no anomalies until enough history exists.
/// </summary>
public interface IAnomalyDetector
{
    IEnumerable<Anomaly> Detect(SensorReading reading);
}

public class AnomalyDetectionService(IDataStore store) : IAnomalyDetector
{
    private const int WindowSize = 20;
    private const int MinWindowSize = 3;   // Need at least 3 points for meaningful stddev
    private const double ZScoreThreshold = 2.5;

    public IEnumerable<Anomaly> Detect(SensorReading reading)
    {
        // Fetch the window BEFORE the current reading was added so it isn't
        // included in its own baseline calculation.
        var window = store.GetRecent(WindowSize);

        if (window.Count < MinWindowSize)
            return [];

        var anomalies = new List<Anomaly>();

        Check(reading, "Temperature", reading.Temperature,
              window.Select(r => (double)r.Temperature), anomalies);

        Check(reading, "Humidity", reading.Humidity,
              window.Select(r => (double)r.Humidity), anomalies);

        Check(reading, "CO2", reading.Co2Ppm,
              window.Select(r => (double)r.Co2Ppm), anomalies);

        return anomalies;
    }

    private static void Check(
        SensorReading reading,
        string sensorType,
        decimal value,
        IEnumerable<double> windowValues,
        List<Anomaly> anomalies)
    {
        var values = windowValues.ToList();

        var mean = values.Average();
        var stdDev = StdDev(values, mean);

        // Avoid division by zero when all window values are identical
        if (stdDev < 1e-10) return;

        var zScore = Math.Abs(((double)value - mean) / stdDev);

        if (zScore > ZScoreThreshold)
        {
            anomalies.Add(new Anomaly
            {
                Id = Guid.NewGuid(),
                DetectedAt = reading.Timestamp,
                SensorType = sensorType,
                Value = value,
                ZScore = (decimal)Math.Round(zScore, 4),
                Reason = $"{sensorType} value {value} has Z-score {zScore:F2} " +
                         $"(window mean={mean:F2}, stddev={stdDev:F2}, n={values.Count})."
            });
        }
    }

    /// <summary>Population standard deviation of the window.</summary>
    private static double StdDev(List<double> values, double mean)
    {
        double sumSq = values.Sum(v => (v - mean) * (v - mean));
        return Math.Sqrt(sumSq / values.Count);
    }
}

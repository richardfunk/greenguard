using GreenGuard.WebApi.Hubs;
using GreenGuard.WebApi.Models;
using Microsoft.AspNetCore.SignalR;

namespace GreenGuard.WebApi.Services;

public class ReadingIngestionService(
    IDataStore store,
    IAnomalyDetector detector,
    IHubContext<SensorHub> hubContext,
    ILogger<ReadingIngestionService> logger)
{
    public async Task IngestAsync(IEnumerable<SensorReading> readings)
    {
        foreach (var reading in readings)
        {
            // Assign server-side defaults if not provided
            if (reading.Id == Guid.Empty)
                reading.Id = Guid.NewGuid();

            if (reading.Timestamp == default)
                reading.Timestamp = DateTime.UtcNow;

            store.Add(reading);
            logger.LogDebug("Stored reading {Id} seq={Seq}", reading.Id, reading.SequenceNumber);

            await hubContext.Clients.All.SendAsync("ReceiveReading", reading);

            var anomalies = detector.Detect(reading).ToList();
            foreach (var anomaly in anomalies)
            {
                store.AddAnomaly(anomaly);
                logger.LogWarning(
                    "Anomaly detected: {SensorType} z={ZScore:F2} value={Value}",
                    anomaly.SensorType, anomaly.ZScore, anomaly.Value);

                await hubContext.Clients.All.SendAsync("ReceiveAnomaly", anomaly);
            }
        }
    }
}

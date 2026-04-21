using Microsoft.AspNetCore.SignalR;

namespace GreenGuard.WebApi.Hubs;

/// <summary>
/// SignalR hub that the Angular SignalRService connects to at /hubs/sensor.
///
/// Client-side methods pushed from the server:
///   - "ReceiveReading"  → SensorReading payload  (matches sensorReading$ subject)
///   - "ReceiveAnomaly"  → Anomaly payload         (matches anomaly$ subject)
///
/// The hub itself is connectionless — it only receives connections and lets the
/// server push data via IHubContext&lt;SensorHub&gt; injected into the controllers.
/// </summary>
public class SensorHub(ILogger<SensorHub> logger) : Hub
{
    public override async Task OnConnectedAsync()
    {
        logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}

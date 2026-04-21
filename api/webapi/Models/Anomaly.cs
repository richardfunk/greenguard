namespace GreenGuard.WebApi.Models;

public class Anomaly
{
    public Guid Id { get; set; }
    public DateTime DetectedAt { get; set; }
    public string SensorType { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public decimal ZScore { get; set; }
    public string Reason { get; set; } = string.Empty;
}

namespace GreenGuard.WebApi.Models;

public class SensorReading
{
    public Guid Id { get; set; }
    public long SequenceNumber { get; set; }
    public DateTime Timestamp { get; set; }
    public decimal Temperature { get; set; }
    public decimal Humidity { get; set; }
    public int Co2Ppm { get; set; }
}

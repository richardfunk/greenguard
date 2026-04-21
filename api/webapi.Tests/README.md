# GreenGuard Web API — Tests

xUnit test project for `GreenGuard.WebApi`. Uses NSubstitute for mocking.

## Running

```bash
dotnet test
```

## Test Coverage

### AnomalyDetectionServiceTests (2 tests)

Uses a mocked `IDataStore` returning a controlled window. The baseline window used in tests is 5 readings with linearly varied values (mean=22/60/600, stdDev≈1.41), making spikes easy to calculate.

| Test | What it verifies |
|------|-----------------|
| `Detect_NormalReading_ReturnsNoAnomalies` | In-range value produces no anomalies |
| `Detect_MultipleSpikes_ReturnsOneAnomalyPerSensor` | Multiple simultaneous spikes each produce their own anomaly |

### ReadingIngestionServiceTests (2 tests)

Uses mocked `IDataStore`, `IAnomalyDetector`, and `IHubContext<SensorHub>`. Hub broadcasts are verified via `IClientProxy.SendCoreAsync` (the method the `SendAsync` extension delegates to).

| Test | What it verifies |
|------|-----------------|
| `IngestAsync_BroadcastsReceiveReadingForEachReading` | `ReceiveReading` is broadcast once per reading |
| `IngestAsync_WhenAnomalyDetected_BroadcastsReceiveAnomaly` | `ReceiveAnomaly` is broadcast when an anomaly is detected |

## Dependencies

| Package | Purpose |
|---------|---------|
| `xunit` | Test framework |
| `xunit.runner.visualstudio` | Rider / VS test runner integration |
| `NSubstitute` | Mocking `IDataStore`, `IAnomalyDetector`, `IHubContext` |
| `Microsoft.NET.Test.Sdk` | Test host |

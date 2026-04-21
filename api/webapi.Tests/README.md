# GreenGuard Web API — Tests

xUnit test project for `GreenGuard.WebApi`. Uses NSubstitute for mocking.

## Running

```bash
dotnet test
```

## Test Coverage

### InMemoryDataStorageServiceTests (11 tests)

Covers `GetLatest`, `GetRecent`, `AddAnomaly`, and `GetRecentAnomalies` on the in-memory store.

| Test | What it verifies |
|------|-----------------|
| `GetLatest_WhenEmpty_ReturnsNull` | Empty store returns null |
| `GetLatest_ReturnsReadingWithNewestTimestamp` | Latest is determined by `Timestamp`, not insertion order |
| `GetLatest_SameTimestamp_ReturnsHighestSequenceNumber` | `SequenceNumber` is the tiebreaker when timestamps collide |
| `GetRecent_ReturnsRequestedCountOldestFirst` | Returns the N most recent readings in ascending timestamp order |
| `GetRecent_WhenCountExceedsTotal_ReturnsAll` | Does not panic when count > stored readings |
| `GetRecent_Empty_ReturnsEmptyList` | Empty store returns empty list |
| `AddAnomaly_GetRecentAnomalies_RoundTrips` | Stored anomaly is retrievable |
| `GetRecentAnomalies_ReturnsAscendingByTimestamp` | Anomalies are ordered oldest-first regardless of insertion order |
| `GetRecentAnomalies_ReturnsOnlyRequestedCount` | Count cap is respected |
| `AddAnomaly_WhenExceedsCap_EvictsOldestByTimestamp` | Oldest anomaly (by `DetectedAt`) is dropped when the 20-item cap is exceeded |

### AnomalyDetectionServiceTests (11 tests)

Uses a mocked `IDataStore` returning a controlled window. The baseline window used in tests is 5 readings with linearly varied values (mean=22/60/600, stdDev≈1.41), making spikes easy to calculate.

| Test | What it verifies |
|------|-----------------|
| `Detect_WhenWindowBelowMinSize_ReturnsEmpty` | No detection until at least 3 baseline readings exist |
| `Detect_WhenWindowAtMinSize_RunsDetection` | Detection runs at exactly 3 readings |
| `Detect_NormalReading_ReturnsNoAnomalies` | In-range value produces no anomalies |
| `Detect_AllWindowValuesIdentical_ReturnsEmpty` | Zero stdDev guard prevents division by zero |
| `Detect_TemperatureSpike_ReturnsTemperatureAnomaly` | `Temperature` outlier is flagged with correct `SensorType` |
| `Detect_HumiditySpike_ReturnsHumidityAnomaly` | `Humidity` outlier is flagged |
| `Detect_Co2Spike_ReturnsCo2Anomaly` | `Co2Ppm` outlier is flagged |
| `Detect_MultipleSpikes_ReturnsOneAnomalyPerSensor` | Multiple simultaneous spikes each produce their own anomaly |
| `Detect_Anomaly_HasCorrectFields` | `Id`, `DetectedAt`, `Value`, `ZScore`, and `Reason` are all populated correctly |
| `Detect_FetchesWindowOf20FromStore` | Service calls `store.GetRecent(20)` |

### ReadingIngestionServiceTests (9 tests)

Uses mocked `IDataStore`, `IAnomalyDetector`, and `IHubContext<SensorHub>`. Hub broadcasts are verified via `IClientProxy.SendCoreAsync` (the method the `SendAsync` extension delegates to).

| Test | What it verifies |
|------|-----------------|
| `IngestAsync_AssignsIdWhenEmpty` | `Guid.Empty` is replaced with a new id |
| `IngestAsync_PreservesExistingId` | Provided id is not overwritten |
| `IngestAsync_AssignsTimestampWhenDefault` | Default `DateTime` is replaced with `UtcNow` |
| `IngestAsync_PreservesExistingTimestamp` | Provided timestamp is not overwritten |
| `IngestAsync_CallsStoreAddForEachReading` | `store.Add` is called once per reading |
| `IngestAsync_BroadcastsReceiveReadingForEachReading` | `ReceiveReading` is broadcast once per reading |
| `IngestAsync_WhenNoAnomalies_DoesNotBroadcastReceiveAnomaly` | `ReceiveAnomaly` is not broadcast when detector returns nothing |
| `IngestAsync_WhenAnomalyDetected_StoresAnomaly` | Detected anomaly is persisted via `store.AddAnomaly` |
| `IngestAsync_WhenAnomalyDetected_BroadcastsReceiveAnomaly` | `ReceiveAnomaly` is broadcast when an anomaly is detected |
| `IngestAsync_MultipleReadingsWithAnomalies_StoresAndBroadcastsAll` | Each reading's anomalies are independently stored and broadcast |
| `IngestAsync_CallsDetectForEachReading` | `detector.Detect` is called once per reading |

## Dependencies

| Package | Purpose |
|---------|---------|
| `xunit` | Test framework |
| `xunit.runner.visualstudio` | Rider / VS test runner integration |
| `NSubstitute` | Mocking `IDataStore`, `IAnomalyDetector`, `IHubContext` |
| `Microsoft.NET.Test.Sdk` | Test host |

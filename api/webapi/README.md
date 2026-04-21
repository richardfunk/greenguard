# GreenGuard Web API

.NET 8 Web API for ingesting greenhouse sensor readings, detecting anomalies, and broadcasting real-time updates via SignalR.

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/readings/latest` | Returns the most recent sensor reading |
| `POST` | `/api/readings` | Ingests a single reading or an array of readings |
| `GET` | `/api/anomalies` | Returns the 20 most recent anomalies |

### POST /api/readings

Accepts either a single object or an array:

```json
{ "sequenceNumber": 1001, "temperature": 22.1, "humidity": 61.3, "co2Ppm": 582 }
```

```json
[
  { "sequenceNumber": 1001, "temperature": 22.1, "humidity": 61.3, "co2Ppm": 582 },
  { "sequenceNumber": 1002, "temperature": 21.8, "humidity": 62.0, "co2Ppm": 595 }
]
```

`id` and `timestamp` are assigned server-side if omitted.

## SignalR

Connect to `/hubs/sensor`. The server pushes two event types:

| Event | Payload | Description |
|-------|---------|-------------|
| `ReceiveReading` | `SensorReading` | Fired for every reading accepted |
| `ReceiveAnomaly` | `Anomaly` | Fired when a Z-score anomaly is detected |

CORS is configured to allow connections from `http://localhost:4200` and `https://localhost:4200` (Angular dev server). `AllowCredentials` is enabled as required by SignalR.

## Project Structure

```
Controllers/
  ReadingsController.cs       GET /api/readings/latest, POST /api/readings
  AnomaliesController.cs      GET /api/anomalies
Hubs/
  SensorHub.cs                SignalR hub at /hubs/sensor
Models/
  SensorReading.cs
  Anomaly.cs
Services/
  IDataStore.cs               Interface (defined in InMemoryDataStorageService.cs)
  InMemoryDataStorageService  Thread-safe in-memory store; SortedSet keyed by Timestamp
  IAnomalyDetector            Interface (defined in AnomalyDetectionService.cs)
  AnomalyDetectionService     Z-score detection over a rolling window of 20 readings
  ReadingIngestionService     Orchestrates store, detection, and SignalR broadcast
TestData/
  sensor-readings.json        10 batches of test readings (~10% contain anomalies)
Properties/
  launchSettings.json         Rider run profiles (http: 5000, https: 5443)
```

## Anomaly Detection

Uses a population Z-score over the 20 most recent readings in the store (captured before the current reading is added). A reading is flagged when `|Z| > 2.5` for any of the three sensors. Requires at least 3 baseline readings before detection runs.

## Running

```bash
dotnet run
```

Swagger UI is available at `/swagger` in Development mode.

## Test Data

Use `TestData/sensor-readings.json` to seed the API. Each of the 10 top-level arrays is one `POST /api/readings` batch. Post them sequentially — anomalies appear in batches 3–10 once enough baseline data has accumulated.

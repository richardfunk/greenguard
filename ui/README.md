# Greenhouse Monitor — Angular 17 Dashboard

Real-time sensor monitoring dashboard built with Angular 17, TypeScript, RxJS, and Chart.js.
Connects to the SensorApi .NET 8 backend via SignalR and REST.

## Quick start

```bash
npm install
npm start
# Opens at http://localhost:4200
```

## Project structure

```
app/
  components/
    header/                      Title, connection badge, last-updated timestamp
    sensor-card/                 Per-sensor card with sparkline (temp / humidity / CO₂)
    sensor-chart/                Chart.js line chart — last 20 readings, tab per sensor
    anomaly-list/                Auto-scrolling list of last 10 anomaly events
  models/
    models.ts                    SensorReading, Anomaly, ConnectionStatus, SensorStatus
  services/
    signalr.service.ts           SignalR hub wrapper (sensorReading$, anomaly$, connectionStatus$)
    readings-api.service.ts      REST calls — GET latest, POST readings, GET anomalies
    dashboard-state.service.ts   RxJS state — rolling window, Z-score detection, card derivation
  app.component.*                Root component — single vm$ observable via combineLatest
  app.config.ts                  Angular providers
environments/
    environment.ts               Dev  — apiBaseUrl: http://localhost:5000
    environment.prod.ts          Prod — update apiBaseUrl before building
```

## Connecting to the API

The `apiBaseUrl` in `src/environments/environment.ts` must point to your running SensorApi instance.

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000'   // ← change if API runs on a different port/host
};
```

SignalR hub URL is derived automatically: `${apiBaseUrl}/hubs/sensor`

## Architecture

### State management (RxJS)

`DashboardStateService` is the single source of truth:

- `readings$` — `scan` accumulator of all received `SensorReading` objects
- `latestReading$` — derived via `map` + `distinctUntilChanged`
- `temperatureCard$`, `humidityCard$`, `co2Card$` — each derived from `readings$` via `map`, computing rolling Z-score against the last 20 readings
- `anomalies$` — `BehaviorSubject<Anomaly[]>` updated by SignalR pushes and the REST backfill

`AppComponent` consumes a single `vm$` observable composed with `combineLatest`, passed into the template via `async` pipe. All child components are `OnPush`.

### SignalR events

| Event            | Stream                    |
|------------------|---------------------------|
| `ReceiveReading` | `SignalRService.sensorReading$` |
| `ReceiveAnomaly` | `SignalRService.anomaly$`       |

### Anomaly detection (client-side fallback)

`DashboardStateService.detectAndPushAnomalies()` mirrors the server-side logic:
- Rolling window of last 20 readings (excludes current from its own baseline)
- Population std dev per sensor channel
- Flags when `|Z-score| > 2.5`

This is only active when using `pushReading()` directly (e.g. simulation/testing).
In production, anomaly events come from the server via `ReceiveAnomaly`.

### Sensor card status colours

| Z-score range | Status   | Colour |
|---------------|----------|--------|
| 0 – 1.5       | Nominal  | Green  |
| 1.5 – 2.5     | Warning  | Amber  |
| > 2.5         | Critical | Red    |

## Building for production

```bash
npm run build
# Output: dist/greenhouse-monitor/
```

Update `src/environments/environment.prod.ts` with your production API URL before building.

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, combineLatest } from 'rxjs';
import { map, scan, shareReplay, distinctUntilChanged } from 'rxjs/operators';
import { SensorReading, Anomaly, SensorChannel, SensorStatus, ConnectionStatus } from '../models/models';
import { SignalRService } from './signalr.service';
import { ReadingsApiService } from './readings-api.service';

const HISTORY_WINDOW = 20;
const ANOMALY_WINDOW = 10;
const Z_THRESHOLD = 2.5;
const MIN_WINDOW = 3;

function rollingStats(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

function computeZScore(value: number, mean: number, std: number): number {
  if (std < 1e-10) return 0;
  return Math.abs((value - mean) / std);
}

function statusFromZ(z: number): SensorStatus {
  if (z > Z_THRESHOLD) return 'critical';
  if (z > 1.5) return 'warning';
  return 'nominal';
}

@Injectable({ providedIn: 'root' })
export class DashboardStateService implements OnDestroy {
  // ── Raw streams ──────────────────────────────────────────────────────────
  private readonly readingsSub$ = new Subject<SensorReading>();
  private readonly subs = new Subscription();

  // ── Rolling history (last N readings) ───────────────────────────────────
  readonly readings$ = this.readingsSub$.pipe(
    scan((acc: SensorReading[], r: SensorReading) => {
      const next = [...acc, r];
      return next.length > HISTORY_WINDOW * 3 ? next.slice(-HISTORY_WINDOW * 3) : next;
    }, []),
    shareReplay(1)
  );

  readonly latestReading$ = this.readings$.pipe(
    map(rs => rs.length > 0 ? rs[rs.length - 1] : null),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // ── Anomaly list (last 10) ───────────────────────────────────────────────
  readonly anomalies$ = new BehaviorSubject<Anomaly[]>([]);

  // ── Derived sensor card states ───────────────────────────────────────────
  readonly temperatureCard$ = this.readings$.pipe(
    map(rs => this.buildCardState(rs, 'temperature')),
    shareReplay(1)
  );

  readonly humidityCard$ = this.readings$.pipe(
    map(rs => this.buildCardState(rs, 'humidity')),
    shareReplay(1)
  );

  readonly co2Card$ = this.readings$.pipe(
    map(rs => this.buildCardState(rs, 'co2')),
    shareReplay(1)
  );

  // ── Connection status passthrough ────────────────────────────────────────
  readonly connectionStatus$ = this.signalR.connectionStatus$;

  constructor(
    private readonly signalR: SignalRService,
    private readonly api: ReadingsApiService
  ) {
    this.subs.add(
      this.signalR.sensorReading$.subscribe(r => this.readingsSub$.next(r))
    );
    this.subs.add(
      this.signalR.anomaly$.subscribe(a => this.pushAnomaly(a))
    );
  }

  async init(): Promise<void> {
    // Load anomaly backfill from REST, then connect SignalR
    this.api.getRecentAnomalies().subscribe({
      next: anomalies => {
        this.anomalies$.next(anomalies.slice(0, ANOMALY_WINDOW));
      },
      error: () => { /* API may not be up yet — ignore */ }
    });

    this.api.getLatestReading().subscribe({
      next: r => this.readingsSub$.next(r),
      error: () => {}
    });

    await this.signalR.connect();
  }

  async disconnect(): Promise<void> {
    await this.signalR.disconnect();
  }

  /** Push a reading manually (used by simulation in dev). */
  pushReading(r: SensorReading): void {
    this.readingsSub$.next(r);
    this.detectAndPushAnomalies(r);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────
  private pushAnomaly(a: Anomaly): void {
    const current = this.anomalies$.getValue();
    const next = [a, ...current].slice(0, ANOMALY_WINDOW);
    this.anomalies$.next(next);
  }

  private detectAndPushAnomalies(reading: SensorReading): void {
    // Used only in simulation mode — mirrors server-side logic
    // In production the server broadcasts anomalies via SignalR
    const readings = this.getRecentReadings();
    if (readings.length < MIN_WINDOW) return;

    const checks: Array<{ channel: SensorChannel; sensorType: 'Temperature' | 'Humidity' | 'CO2'; value: number; unit: string }> = [
      { channel: 'temperature', sensorType: 'Temperature', value: reading.temperature, unit: '°C' },
      { channel: 'humidity',    sensorType: 'Humidity',    value: reading.humidity,    unit: '%' },
      { channel: 'co2',         sensorType: 'CO2',         value: reading.co2Ppm,      unit: ' ppm' }
    ];

    for (const c of checks) {
      const vals = readings.map(r => this.extractChannel(r, c.channel));
      const { mean, std } = rollingStats(vals);
      const z = computeZScore(c.value, mean, std);
      if (z > Z_THRESHOLD) {
        const anomaly: Anomaly = {
          id: crypto.randomUUID(),
          detectedAt: reading.timestamp,
          sensorType: c.sensorType,
          value: c.value,
          zScore: parseFloat(z.toFixed(2)),
          reason: `${c.sensorType} ${c.value}${c.unit} — Z-score ${z.toFixed(2)} (mean ${mean.toFixed(1)}, σ ${std.toFixed(2)}, n=${vals.length})`
        };
        this.pushAnomaly(anomaly);
      }
    }
  }

  private recentReadingsCache: SensorReading[] = [];
  private getRecentReadings(): SensorReading[] {
    // Sync access for anomaly detection — updated via subscription
    return this.recentReadingsCache.slice(-HISTORY_WINDOW);
  }

  private buildCardState(readings: SensorReading[], channel: SensorChannel): {
    value: number | null;
    status: SensorStatus;
    history: number[];
    zScore: number;
  } {
    if (readings.length === 0) return { value: null, status: 'nominal', history: [], zScore: 0 };

    const history = readings.slice(-HISTORY_WINDOW).map(r => this.extractChannel(r, channel));
    const current = history[history.length - 1];
    const window = history.slice(0, -1); // exclude current from its own baseline

    if (window.length < MIN_WINDOW) {
      return { value: current, status: 'nominal', history, zScore: 0 };
    }

    const { mean, std } = rollingStats(window);
    const z = computeZScore(current, mean, std);
    const status = statusFromZ(z);

    // Update cache
    this.recentReadingsCache = readings;

    return { value: current, status, history, zScore: z };
  }

  private extractChannel(r: SensorReading, channel: SensorChannel): number {
    switch (channel) {
      case 'temperature': return r.temperature;
      case 'humidity':    return r.humidity;
      case 'co2':         return r.co2Ppm;
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}

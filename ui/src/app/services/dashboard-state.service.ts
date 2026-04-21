import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { map, scan, shareReplay, distinctUntilChanged, pairwise, startWith } from 'rxjs/operators';
import { SensorReading, Anomaly, SensorChannel, SensorStatus, ConnectionStatus } from '../models/models';
import { SignalRService } from './signalr.service';
import { ReadingsApiService } from './readings-api.service';

const HISTORY_WINDOW = 20;
const ANOMALY_WINDOW = 10;
const Z_CRITICAL_THRESHOLD = 2.5;
const Z_WARNING_THRESHOLD = 1.5;

const CHANNEL_TO_SENSOR_TYPE: Record<SensorChannel, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  co2: 'CO2'
};

function statusFromZ(z: number): SensorStatus {
  if (z > Z_CRITICAL_THRESHOLD) return 'critical';
  if (z > Z_WARNING_THRESHOLD) return 'warning';
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
    }, [] as SensorReading[]),
    startWith([] as SensorReading[]),
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
    map(rs => this.buildCardState(rs, this.anomalies$.getValue(), 'temperature')),
    shareReplay(1)
  );

  readonly humidityCard$ = this.readings$.pipe(
    map(rs => this.buildCardState(rs, this.anomalies$.getValue(), 'humidity')),
    shareReplay(1)
  );

  readonly co2Card$ = this.readings$.pipe(
    map(rs => this.buildCardState(rs, this.anomalies$.getValue(), 'co2')),
    shareReplay(1)
  );

  // ── Connection status ────────────────────────────────────────────────────
  readonly connectionStatus$: BehaviorSubject<ConnectionStatus> = this.signalR.connectionStatus$;

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

    // Refresh data when reconnecting → connected (skip the first connect — init() handles that)
    this.subs.add(
      this.signalR.connectionStatus$.pipe(
        pairwise()
      ).subscribe(([prev, curr]) => {
        if (curr === 'connected' && prev !== 'connected') {
          this.refreshData();
        }
      })
    );
  }

  async init(): Promise<void> {
    this.refreshData();
    await this.signalR.connect();
  }

  private refreshData(): void {
    this.api.getRecentAnomalies().subscribe({
      next: anomalies => {
        this.anomalies$.next(anomalies.slice(0, ANOMALY_WINDOW));
      },
      error: () => {}
    });

    this.api.getReadings().subscribe({
      next: readings => readings.forEach(r => this.readingsSub$.next(r)),
      error: () => {}
    });
  }

  async disconnect(): Promise<void> {
    await this.signalR.disconnect();
  }

  // ── Internal helpers ──────────────────────────────────────────────────────
  private pushAnomaly(a: Anomaly): void {
    const current = this.anomalies$.getValue();
    const next = [a, ...current].slice(0, ANOMALY_WINDOW);
    this.anomalies$.next(next);
  }

  private buildCardState(readings: SensorReading[], anomalies: Anomaly[], channel: SensorChannel): {
    value: number | null;
    status: SensorStatus;
    zScore: number;
  } {
    if (readings.length === 0) return { value: null, status: 'nominal', zScore: 0 };

    const latest = readings[readings.length - 1];
    const value = this.extractChannel(latest, channel);
    const sensorType = CHANNEL_TO_SENSOR_TYPE[channel];

    const latestAnomaly = anomalies.find(a => a.sensorType === sensorType);
    if (latestAnomaly && new Date(latestAnomaly.detectedAt) >= new Date(latest.timestamp)) {
      return { value, status: statusFromZ(latestAnomaly.zScore), zScore: latestAnomaly.zScore };
    }

    return { value, status: 'nominal', zScore: 0 };
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

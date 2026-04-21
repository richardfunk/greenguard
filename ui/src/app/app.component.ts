import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import { HeaderComponent }      from './components/header/header.component';
import { SensorCardComponent }  from './components/sensor-card/sensor-card.component';
import { SensorChartComponent } from './components/sensor-chart/sensor-chart.component';
import { AnomalyListComponent } from './components/anomaly-list/anomaly-list.component';

import { DashboardStateService }  from './services/dashboard-state.service';
import { OfflineQueueService }    from './services/offline-queue.service';
import { SensorReading, Anomaly, ConnectionStatus, SensorStatus } from './models/models';

interface DashboardVM {
  connectionStatus: ConnectionStatus;
  lastUpdated: string | null;
  temperatureValue: number | null;
  temperatureStatus: SensorStatus;
  temperatureHistory: number[];
  temperatureZScore: number;
  humidityValue: number | null;
  humidityStatus: SensorStatus;
  humidityHistory: number[];
  humidityZScore: number;
  co2Value: number | null;
  co2Status: SensorStatus;
  co2History: number[];
  co2ZScore: number;
  readings: SensorReading[];
  anomalies: Anomaly[];
  pendingCount: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SensorCardComponent,
    SensorChartComponent,
    AnomalyListComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  vm$!: Observable<DashboardVM>;

  constructor(
    private readonly state: DashboardStateService,
    private readonly queue: OfflineQueueService
  ) {}

  ngOnInit(): void {
    this.vm$ = combineLatest([
      this.state.connectionStatus$,
      this.state.latestReading$,
      this.state.temperatureCard$,
      this.state.humidityCard$,
      this.state.co2Card$,
      this.state.readings$,
      this.state.anomalies$,
      this.queue.pendingCount$
    ]).pipe(
      map(([status, latest, temp, hum, co2, readings, anomalies, pendingCount]) => ({
        connectionStatus: status,
        lastUpdated: latest?.timestamp ?? null,
        temperatureValue: temp.value,
        temperatureStatus: temp.status,
        temperatureHistory: temp.history,
        temperatureZScore: temp.zScore,
        humidityValue: hum.value,
        humidityStatus: hum.status,
        humidityHistory: hum.history,
        humidityZScore: hum.zScore,
        co2Value: co2.value,
        co2Status: co2.status,
        co2History: co2.history,
        co2ZScore: co2.zScore,
        readings,
        anomalies,
        pendingCount
      }))
    );

    this.state.init().catch(err =>
      console.error('Dashboard init error:', err)
    );
  }

  ngOnDestroy(): void {
    this.state.disconnect();
  }
}

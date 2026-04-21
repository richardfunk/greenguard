import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SensorReading, Anomaly } from '../models/models';
import { OfflineQueueService } from './offline-queue.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReadingsApiService {
  private readonly base = environment.apiBaseUrl;

  constructor(
    private http: HttpClient,
    private queue: OfflineQueueService
  ) {}

  getLatestReading(): Observable<SensorReading> {
    return this.http.get<SensorReading>(`${this.base}/api/readings/latest`);
  }

  /**
   * Post a single reading with offline-queue fallback.
   * If the request fails (network down, server unreachable) the reading
   * is persisted to localStorage and retried when the connection comes back.
   */
  postReading(reading: Partial<SensorReading>): Promise<void> {
    return this.queue.send(reading);
  }

  /**
   * Post a batch of readings. Each item is enqueued individually so partial
   * failures don't lose the whole batch.
   */
  postReadings(readings: Partial<SensorReading>[]): Promise<void[]> {
    return Promise.all(readings.map(r => this.queue.send(r)));
  }

  getRecentAnomalies(): Observable<Anomaly[]> {
    return this.http.get<Anomaly[]>(`${this.base}/api/anomalies`);
  }
}

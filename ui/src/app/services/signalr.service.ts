import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { SensorReading, Anomaly, ConnectionStatus } from '../models/models';
import { OfflineQueueService } from './offline-queue.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  public readonly sensorReading$ = new Subject<SensorReading>();
  public readonly anomaly$ = new Subject<Anomaly>();
  public readonly connectionStatus$ = new BehaviorSubject<ConnectionStatus>('disconnected');

  private hubConnection: signalR.HubConnection | null = null;

  constructor(private queue: OfflineQueueService) {}

  async connect(): Promise<void> {
    if (this.hubConnection) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/hubs/sensor`)
      .withAutomaticReconnect([1000, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.hubConnection.on('ReceiveReading', (reading: SensorReading) => {
      this.sensorReading$.next(reading);
    });

    this.hubConnection.on('ReceiveAnomaly', (anomaly: Anomaly) => {
      this.anomaly$.next(anomaly);
    });

    this.hubConnection.onreconnecting(() => {
      this.connectionStatus$.next('reconnecting');
    });

    this.hubConnection.onreconnected(() => {
      this.connectionStatus$.next('connected');
      // Flush any readings queued while offline
      this.queue.notifyOnline();
    });

    this.hubConnection.onclose(() => {
      this.connectionStatus$.next('disconnected');
    });

    this.connectionStatus$.next('connecting');

    try {
      await this.hubConnection.start();
      this.connectionStatus$.next('connected');
      // Flush any readings that were queued before this session started
      this.queue.notifyOnline();
    } catch (err) {
      console.error('SignalR connection failed:', err);
      this.connectionStatus$.next('disconnected');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.hubConnection) return;
    await this.hubConnection.stop();
    this.hubConnection = null;
    this.connectionStatus$.next('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}

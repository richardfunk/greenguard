import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { SensorReading, Anomaly, ConnectionStatus } from '../models/models';
import { OfflineQueueService } from './offline-queue.service';
import { environment } from '../../environments/environment';

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000];
const RECONNECT_STEADY_MS = 10000;

@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  public readonly sensorReading$ = new Subject<SensorReading>();
  public readonly anomaly$ = new Subject<Anomaly>();
  public readonly connectionStatus$ = new BehaviorSubject<ConnectionStatus>('disconnected');

  private hubConnection: signalR.HubConnection | null = null;
  private intentionalStop = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private queue: OfflineQueueService) {}

  async connect(): Promise<void> {
    if (this.intentionalStop) return;

    // Already active — connected, connecting, or mid auto-reconnect
    if (this.hubConnection &&
        this.hubConnection.state !== signalR.HubConnectionState.Disconnected) {
      return;
    }

    this.clearReconnectTimer();
    this.hubConnection = this.buildConnection();
    this.connectionStatus$.next('connecting');

    try {
      await this.hubConnection.start();
      this.connectionStatus$.next('connected');
      this.queue.notifyOnline();
    } catch {
      // start() failed — server not up yet. Discard the dead connection object
      // and schedule another attempt; keep retrying until the server is back.
      this.hubConnection = null;
      this.connectionStatus$.next('disconnected');
      this.scheduleReconnect(RECONNECT_STEADY_MS);
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalStop = true;
    this.clearReconnectTimer();
    if (!this.hubConnection) return;
    await this.hubConnection.stop();
    this.hubConnection = null;
    this.connectionStatus$.next('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildConnection(): signalR.HubConnection {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/hubs/sensor`)
      .withAutomaticReconnect({
        // Handles unexpected mid-session drops (network blip, server crash mid-stream)
        nextRetryDelayInMilliseconds: ctx =>
          ctx.previousRetryCount < RECONNECT_DELAYS_MS.length
            ? RECONNECT_DELAYS_MS[ctx.previousRetryCount]
            : RECONNECT_STEADY_MS
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveReading', (reading: SensorReading) => {
      this.sensorReading$.next(reading);
    });

    connection.on('ReceiveAnomaly', (anomaly: Anomaly) => {
      this.anomaly$.next(anomaly);
    });

    connection.onreconnecting(() => {
      this.connectionStatus$.next('reconnecting');
    });

    connection.onreconnected(() => {
      this.connectionStatus$.next('connected');
      this.queue.notifyOnline();
    });

    // onclose fires when:
    //  - the server sends a clean close frame (graceful shutdown) — auto-reconnect
    //    does NOT engage for clean closes, so we handle it manually here
    //  - the retry policy gives up (never happens with our indefinite policy)
    //  - disconnect() was called intentionally
    connection.onclose(() => {
      this.hubConnection = null;
      this.connectionStatus$.next('disconnected');
      this.scheduleReconnect(RECONNECT_STEADY_MS);
    });

    return connection;
  }

  private scheduleReconnect(delayMs: number): void {
    if (this.intentionalStop) return;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => this.connect(), delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

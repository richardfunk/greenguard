import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import * as signalR from '@microsoft/signalr';

export interface SensorReading {
    id: string;
    sequenceNumber: number;
    timestamp: string;
    temperature: number;
    humidity: number;
    co2Ppm: number;
}

export interface Anomaly {
    id: string;
    detectedAt: string;
    sensorType: string;
    value: number;
    zScore: number;
    reason: string;
}

@Injectable({ providedIn: 'root' })
export class SignalRService {
    public sensorReading$ = new Subject<SensorReading>();
    public anomaly$ = new Subject<Anomaly>();
    public connectionStatus$ = new BehaviorSubject<string>('disconnected');

    private hubConnection: signalR.HubConnection | null = null;

    // Change this to match your API's base URL
    private readonly hubUrl = 'http://localhost:5000/hubs/sensor';

    connect(): Promise<void> {
        if (this.hubConnection) {
            return Promise.resolve();
        }

        this.hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(this.hubUrl)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        // Listen for server-pushed readings
        this.hubConnection.on('ReceiveReading', (reading: SensorReading) => {
            this.sensorReading$.next(reading);
        });

        // Listen for server-pushed anomalies
        this.hubConnection.on('ReceiveAnomaly', (anomaly: Anomaly) => {
            this.anomaly$.next(anomaly);
        });

        // Track connection lifecycle
        this.hubConnection.onreconnecting(() => {
            this.connectionStatus$.next('reconnecting');
        });

        this.hubConnection.onreconnected(() => {
            this.connectionStatus$.next('connected');
        });

        this.hubConnection.onclose(() => {
            this.connectionStatus$.next('disconnected');
        });

        this.connectionStatus$.next('connecting');

        return this.hubConnection
            .start()
            .then(() => {
                this.connectionStatus$.next('connected');
            })
            .catch((err: unknown) => {
                this.connectionStatus$.next('disconnected');
                throw err;
            });
    }

    disconnect(): Promise<void> {
        if (!this.hubConnection) {
            return Promise.resolve();
        }

        return this.hubConnection.stop().then(() => {
            this.hubConnection = null;
            this.connectionStatus$.next('disconnected');
        });
    }
}

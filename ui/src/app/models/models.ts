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
  sensorType: 'Temperature' | 'Humidity' | 'CO2';
  value: number;
  zScore: number;
  reason: string;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'connecting';

export type SensorStatus = 'nominal' | 'warning' | 'critical';

export type SensorChannel = 'temperature' | 'humidity' | 'co2';

export interface SensorCardData {
  label: string;
  channel: SensorChannel;
  value: number | null;
  unit: string;
  status: SensorStatus;
  history: number[];
}

export interface OfflineQueueState {
  pendingCount: number;
  flushStatus: 'idle' | 'flushing' | 'error';
}

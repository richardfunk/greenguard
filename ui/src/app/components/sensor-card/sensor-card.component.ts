import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensorStatus, SensorChannel } from '../../models/models';

const CHANNEL_CONFIG: Record<SensorChannel, { label: string; unit: string; icon: string }> = {
  temperature: { label: 'Temperature', unit: '°C',   icon: '🌡' },
  humidity:    { label: 'Humidity',    unit: '%',    icon: '💧' },
  co2:         { label: 'CO₂',        unit: ' ppm', icon: '🌿' }
};

@Component({
  selector: 'app-sensor-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sensor-card.component.html',
  styleUrls: ['./sensor-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SensorCardComponent {
  @Input() channel: SensorChannel = 'temperature';
  @Input() value: number | null = null;
  @Input() status: SensorStatus = 'nominal';
  @Input() zScore: number = 0;

  get config() { return CHANNEL_CONFIG[this.channel]; }
  get label()  { return this.config.label; }
  get unit()   { return this.config.unit; }
  get icon()   { return this.config.icon; }

  get displayValue(): string {
    if (this.value === null) return '—';
    return this.channel === 'co2'
      ? Math.round(this.value).toString()
      : this.value.toFixed(1);
  }

  get statusLabel(): string {
    switch (this.status) {
      case 'nominal':  return 'Nominal';
      case 'warning':  return 'Warning';
      case 'critical': return 'Critical';
    }
  }
}

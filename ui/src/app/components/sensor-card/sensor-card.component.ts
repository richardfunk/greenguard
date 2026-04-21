import {
  Component, Input, ViewChild, ElementRef,
  OnChanges, SimpleChanges, AfterViewInit, OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SensorStatus, SensorChannel } from '../../models/models';

Chart.register(...registerables);

const CHANNEL_CONFIG: Record<SensorChannel, {
  label: string;
  unit: string;
  chartColor: Record<SensorStatus, string>;
  icon: string;
}> = {
  temperature: {
    label: 'Temperature',
    unit: '°C',
    chartColor: { nominal: '#639922', warning: '#BA7517', critical: '#E24B4A' },
    icon: '🌡'
  },
  humidity: {
    label: 'Humidity',
    unit: '%',
    chartColor: { nominal: '#1D9E75', warning: '#BA7517', critical: '#E24B4A' },
    icon: '💧'
  },
  co2: {
    label: 'CO₂',
    unit: ' ppm',
    chartColor: { nominal: '#BA7517', warning: '#E24B4A', critical: '#A32D2D' },
    icon: '🌿'
  }
};

@Component({
  selector: 'app-sensor-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sensor-card.component.html',
  styleUrls: ['./sensor-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SensorCardComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() channel: SensorChannel = 'temperature';
  @Input() value: number | null = null;
  @Input() status: SensorStatus = 'nominal';
  @Input() history: number[] = [];
  @Input() zScore: number = 0;

  @ViewChild('sparkCanvas') sparkCanvasRef!: ElementRef<HTMLCanvasElement>;

  private sparkChart: Chart | null = null;
  private viewInitialized = false;

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

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.initSparkline();
    if (this.history.length > 0) this.updateSparkline();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewInitialized) return;
    if (changes['history'] || changes['status']) {
      this.updateSparkline();
    }
  }

  ngOnDestroy(): void {
    this.sparkChart?.destroy();
  }

  private initSparkline(): void {
    const ctx = this.sparkCanvasRef.nativeElement;
    const color = this.config.chartColor[this.status];

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          data: [],
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { line: { borderCapStyle: 'round' } }
      }
    };

    this.sparkChart = new Chart(ctx, config);
  }

  private updateSparkline(): void {
    if (!this.sparkChart) return;
    const color = this.config.chartColor[this.status];
    this.sparkChart.data.labels = this.history.map((_, i) => i);
    this.sparkChart.data.datasets[0].data = [...this.history];
    (this.sparkChart.data.datasets[0] as any).borderColor = color;
    this.sparkChart.update('none');
  }
}

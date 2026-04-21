import {
  Component, Input, ViewChild, ElementRef,
  OnChanges, SimpleChanges, AfterViewInit, OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SensorReading, SensorChannel } from '../../models/models';

Chart.register(...registerables);

interface TabConfig {
  channel: SensorChannel;
  label: string;
  unit: string;
  color: string;
  bgColor: string;
  extract: (r: SensorReading) => number;
  precision: number;
}

const TABS: TabConfig[] = [
  {
    channel: 'temperature', label: 'Temperature', unit: '°C', color: '#639922',
    bgColor: 'rgba(99,153,34,0.07)', extract: r => r.temperature, precision: 1
  },
  {
    channel: 'humidity', label: 'Humidity', unit: '%', color: '#1D9E75',
    bgColor: 'rgba(29,158,117,0.07)', extract: r => r.humidity, precision: 1
  },
  {
    channel: 'co2', label: 'CO₂', unit: ' ppm', color: '#BA7517',
    bgColor: 'rgba(186,117,23,0.07)', extract: r => r.co2Ppm, precision: 0
  }
];

@Component({
  selector: 'app-sensor-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sensor-chart.component.html',
  styleUrls: ['./sensor-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SensorChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() readings: SensorReading[] = [];
  @ViewChild('chartCanvas') chartCanvasRef!: ElementRef<HTMLCanvasElement>;

  readonly tabs = TABS;
  activeTab: TabConfig = TABS[0];

  private chart: Chart | null = null;
  private viewInitialized = false;

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.initChart();
    this.updateChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewInitialized) return;
    if (changes['readings']) this.updateChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  setTab(tab: TabConfig): void {
    this.activeTab = tab;
    if (this.chart) {
      this.chart.data.datasets[0].borderColor = tab.color;
      this.chart.data.datasets[0].backgroundColor = tab.bgColor;
      (this.chart.data.datasets[0] as any).pointBackgroundColor = tab.color;
      this.updateChart();
    }
  }

  private initChart(): void {
    const ctx = this.chartCanvasRef.nativeElement;
    const tab = this.activeTab;

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: tab.label,
          data: [],
          borderColor: tab.color,
          backgroundColor: tab.bgColor,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: tab.color,
          pointBorderWidth: 0,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed.y;
                if (val == null) return '';
                
                const p = this.activeTab.precision;
                return ` ${val.toFixed(p)}${this.activeTab.unit}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              font: { family: "'DM Mono', monospace", size: 10 },
              color: '#9a9a94',
              autoSkip: true,
              maxTicksLimit: 8
            },
            grid: { color: 'rgba(128,128,128,0.07)' }
          },
          y: {
            ticks: {
              font: { family: "'DM Mono', monospace", size: 10 },
              color: '#9a9a94'
            },
            grid: { color: 'rgba(128,128,128,0.07)' }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  private updateChart(): void {
    if (!this.chart || this.readings.length === 0) return;
    const last20 = this.readings.slice(-20);
    const tab = this.activeTab;

    this.chart.data.labels = last20.map(r =>
      new Date(r.timestamp).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    );
    this.chart.data.datasets[0].data = last20.map(tab.extract);
    this.chart.update();
  }
}

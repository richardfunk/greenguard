import {
  Component, Input, OnChanges, SimpleChanges,
  ViewChild, ElementRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Anomaly } from '../../models/models';

@Component({
  selector: 'app-anomaly-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './anomaly-list.component.html',
  styleUrls: ['./anomaly-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnomalyListComponent implements OnChanges {
  @Input() anomalies: Anomaly[] = [];
  @ViewChild('listEl') listRef!: ElementRef<HTMLElement>;

  newestId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['anomalies'] && this.anomalies.length > 0) {
      this.newestId = this.anomalies[0].id;
      // Auto-scroll to top after DOM update
      setTimeout(() => {
        this.listRef?.nativeElement?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    }
  }

  trackByAnomaly(_: number, a: Anomaly): string {
    return a.id;
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  formatValue(a: Anomaly): string {
    const units: Record<string, string> = {
      Temperature: '°C',
      Humidity: '%',
      CO2: ' ppm'
    };
    return `${a.value}${units[a.sensorType] ?? ''}`;
  }

  sensorClass(type: string): string {
    return type.toLowerCase();
  }
}

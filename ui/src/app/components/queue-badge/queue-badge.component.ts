import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { OfflineQueueService, FlushStatus } from '../../services/offline-queue.service';

interface QueueVM {
  count: number;
  status: FlushStatus;
  visible: boolean;
  label: string;
  tooltip: string;
}

@Component({
  selector: 'app-queue-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './queue-badge.component.html',
  styleUrls: ['./queue-badge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QueueBadgeComponent {
  readonly vm$: Observable<QueueVM>;

  constructor(private queueService: OfflineQueueService) {
    this.vm$ = combineLatest([
      this.queueService.pendingCount$,
      this.queueService.flushStatus$
    ]).pipe(
      map(([count, status]) => ({
        count,
        status,
        visible: count > 0 || status === 'flushing',
        label: this.buildLabel(count, status),
        tooltip: this.buildTooltip(count, status)
      }))
    );
  }

  onClearQueue(): void {
    if (confirm('Permanently discard all queued readings?')) {
      this.queueService.clear();
    }
  }

  onRetryNow(): void {
    this.queueService.flush();
  }

  private buildLabel(count: number, status: FlushStatus): string {
    if (status === 'flushing') return 'Syncing…';
    if (count === 1) return '1 pending';
    return `${count} pending`;
  }

  private buildTooltip(count: number, status: FlushStatus): string {
    if (status === 'flushing') return 'Sending queued readings to server';
    if (status === 'error')    return 'Sync failed — will retry on reconnect';
    if (count > 0)             return `${count} reading${count === 1 ? '' : 's'} queued offline`;
    return '';
  }
}

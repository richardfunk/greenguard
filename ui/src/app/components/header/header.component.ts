import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectionStatus } from '../../models/models';
import { QueueBadgeComponent } from '../queue-badge/queue-badge.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, QueueBadgeComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  @Input() connectionStatus: ConnectionStatus = 'disconnected';
  @Input() lastUpdated: string | null = null;

  get statusLabel(): string {
    switch (this.connectionStatus) {
      case 'connected':    return 'LIVE';
      case 'connecting':   return 'CONNECTING';
      case 'reconnecting': return 'RECONNECTING';
      case 'disconnected': return 'OFFLINE';
    }
  }

  get isLive(): boolean {
    return this.connectionStatus === 'connected';
  }

  get formattedTime(): string {
    if (!this.lastUpdated) return '—';
    return new Date(this.lastUpdated).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}

import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Subscription, timer, from, EMPTY } from 'rxjs';
import { switchMap, filter, concatMap, catchError, tap, retryWhen, delay, take } from 'rxjs/operators';
import { SensorReading } from '../models/models';
import { environment } from '../../environments/environment';

export interface QueuedReading {
  /** Stable key — used to deduplicate and remove after success */
  queueId: string;
  reading: Partial<SensorReading>;
  queuedAt: string;
  attempts: number;
}

export type FlushStatus = 'idle' | 'flushing' | 'error';

const STORAGE_KEY = 'gm_offline_queue';
const MAX_QUEUE   = 500;
const RETRY_DELAY = 3_000;   // ms between flush retries
const MAX_ATTEMPTS = 10;

@Injectable({ providedIn: 'root' })
export class OfflineQueueService implements OnDestroy {

  /** Number of readings waiting to be sent. */
  readonly pendingCount$ = new BehaviorSubject<number>(0);

  /** Whether a flush is currently in progress. */
  readonly flushStatus$ = new BehaviorSubject<FlushStatus>('idle');

  /** Emits each successfully flushed reading (for optimistic UI). */
  readonly flushed$ = new BehaviorSubject<QueuedReading | null>(null);

  private subs = new Subscription();
  private readonly postUrl = `${environment.apiBaseUrl}/api/readings`;

  constructor(private http: HttpClient) {
    this.syncCount();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Try to POST a reading immediately.
   * On network/server failure the reading is pushed to the localStorage queue.
   * Returns a promise that resolves once the item is either sent or queued.
   */
  send(reading: Partial<SensorReading>): Promise<void> {
    return this.http
      .post<{ accepted: number }>(this.postUrl, reading)
      .toPromise()
      .then(() => { /* sent live — nothing to queue */ })
      .catch(() => {
        this.enqueue(reading);
      });
  }

  /**
   * Flush all queued readings in order, one by one.
   * Called automatically when SignalR reconnects (via `notifyOnline()`).
   * Safe to call multiple times — re-entrant calls are ignored while flushing.
   */
  flush(): void {
    if (this.flushStatus$.getValue() === 'flushing') return;

    const queue = this.load();
    if (queue.length === 0) return;

    this.flushStatus$.next('flushing');

    // Process items sequentially (concatMap) so order is preserved
    const sub = from(queue).pipe(
      concatMap(item =>
        this.http.post<{ accepted: number }>(this.postUrl, item.reading).pipe(
          tap(() => {
            this.remove(item.queueId);
            this.flushed$.next(item);
          }),
          catchError((err: HttpErrorResponse) => {
            const updated = { ...item, attempts: item.attempts + 1 };
            if (updated.attempts >= MAX_ATTEMPTS) {
              // Give up on this item after too many failures
              this.remove(item.queueId);
            } else {
              this.updateItem(updated);
            }
            return EMPTY; // continue with next item
          })
        )
      )
    ).subscribe({
      complete: () => {
        this.flushStatus$.next('idle');
        this.syncCount();
        sub.unsubscribe();
      },
      error: () => {
        this.flushStatus$.next('error');
        sub.unsubscribe();
      }
    });

    this.subs.add(sub);
  }

  /** Call this when SignalR reports the connection is back. */
  notifyOnline(): void {
    // Small delay lets the connection stabilise before hammering the API
    timer(800).subscribe(() => this.flush());
  }

  /** Wipe the entire queue (e.g. user-initiated reset). */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.syncCount();
  }

  getQueue(): QueuedReading[] {
    return this.load();
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private enqueue(reading: Partial<SensorReading>): void {
    const queue = this.load();
    if (queue.length >= MAX_QUEUE) {
      // Drop oldest item to make room (ring buffer)
      queue.shift();
    }
    const item: QueuedReading = {
      queueId:  this.newId(),
      reading,
      queuedAt: new Date().toISOString(),
      attempts: 0
    };
    queue.push(item);
    this.save(queue);
    this.syncCount();
  }

  private remove(queueId: string): void {
    const queue = this.load().filter(i => i.queueId !== queueId);
    this.save(queue);
    this.syncCount();
  }

  private updateItem(item: QueuedReading): void {
    const queue = this.load().map(i => i.queueId === item.queueId ? item : i);
    this.save(queue);
  }

  private load(): QueuedReading[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private save(queue: QueuedReading[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      // localStorage quota exceeded — drop oldest half and retry
      const half = queue.slice(Math.floor(queue.length / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(half)); } catch { /* give up */ }
    }
  }

  private syncCount(): void {
    this.pendingCount$.next(this.load().length);
  }

  private newId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}

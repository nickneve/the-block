import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { AuctionUpdate, MyBidStatus, VehicleSummary } from './api/models';

export type LiveConnection = 'connecting' | 'live' | 'offline';

/** Messages between this app's tabs. */
type TabMessage =
  | { type: 'update'; update: AuctionUpdate }
  | { type: 'connection'; state: LiveConnection }
  /** A new tab asking the tab that holds the stream how it's doing. */
  | { type: 'hello' };

export const LIVE_CHANNEL = 'the-block.live';
export const LIVE_LOCK = 'the-block.live-stream';

/**
 * Live auction updates: every bid, Buy Now and close anywhere is pushed here,
 * and views subscribe and merge updates into what they're showing.
 *
 * One stream for the whole browser, not one per tab. Over HTTP/1.1 a browser
 * keeps about six connections per site, and every EventSource holds one open,
 * so a dealer with six lots open in tabs would find the next tab never loads.
 * Instead, whichever tab holds a Web Lock opens the stream and relays it to the
 * other tabs over a BroadcastChannel. When that tab closes, the browser hands
 * the lock (and the stream) to another tab. Browsers without these APIs fall
 * back to a stream per tab. EventSource reconnects on its own after a drop.
 */
@Injectable({ providedIn: 'root' })
export class LiveAuctionService {
  private readonly updatesSubject = new Subject<AuctionUpdate>();
  private source?: EventSource;
  private channel?: BroadcastChannel;
  private releaseLock?: () => void;
  private waitingForLock?: AbortController;
  private started = false;
  /** True in the one tab that holds the stream. */
  private leading = false;

  readonly updates$: Observable<AuctionUpdate> = this.updatesSubject.asObservable();
  readonly connection = signal<LiveConnection>('connecting');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  connect(): void {
    if (this.started || typeof EventSource === 'undefined') return;
    this.started = true;

    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (!locks || typeof BroadcastChannel === 'undefined') {
      this.openStream();
      return;
    }

    this.channel = new BroadcastChannel(LIVE_CHANNEL);
    this.channel.onmessage = ({ data }: MessageEvent<TabMessage>) => this.onTabMessage(data);
    this.channel.postMessage({ type: 'hello' } satisfies TabMessage);

    // Held until this tab closes (or the app is torn down); then another tab takes over.
    this.waitingForLock = new AbortController();
    locks
      .request(LIVE_LOCK, { signal: this.waitingForLock.signal }, () => {
        this.leading = true;
        this.openStream();
        return new Promise<void>((resolve) => (this.releaseLock = resolve));
      })
      .catch(() => undefined); // aborted by disconnect() while another tab held the stream
  }

  disconnect(): void {
    this.started = false;
    this.leading = false;
    this.waitingForLock?.abort();
    this.waitingForLock = undefined;
    this.source?.close();
    this.source = undefined;
    this.channel?.close();
    this.channel = undefined;
    this.releaseLock?.();
    this.releaseLock = undefined;
  }

  private openStream(): void {
    const source = new EventSource('/api/events');
    source.onopen = () => this.setConnection('live');
    source.onerror = () => this.setConnection(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting');
    source.addEventListener('auction.updated', (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as AuctionUpdate;
      this.updatesSubject.next(update);
      this.relay({ type: 'update', update });
    });
    this.source = source;
  }

  private setConnection(state: LiveConnection): void {
    this.connection.set(state);
    this.relay({ type: 'connection', state });
  }

  private relay(message: TabMessage): void {
    if (this.leading) this.channel?.postMessage(message);
  }

  private onTabMessage(message: TabMessage): void {
    switch (message.type) {
      case 'update':
        if (!this.leading) this.updatesSubject.next(message.update);
        break;
      case 'connection':
        if (!this.leading) this.connection.set(message.state);
        break;
      case 'hello':
        this.relay({ type: 'connection', state: this.connection() });
        break;
    }
  }
}

/**
 * Applies a broadcast update to a vehicle the client is holding, re-deriving
 * "my" status from the public high-bidder handle (raw bidder ids are never sent).
 */
export function applyAuctionUpdate<T extends VehicleSummary>(vehicle: T, update: AuctionUpdate, myHandle: string | null): T {
  if (vehicle.id !== update.vehicleId) return vehicle;
  return {
    ...vehicle,
    auction: update.auction,
    myStatus: deriveMyStatus(vehicle.myMaxBid, update.auction, myHandle),
  };
}

export function deriveMyStatus(
  myMaxBid: number | null,
  auction: VehicleSummary['auction'],
  myHandle: string | null,
): MyBidStatus | null {
  if (myMaxBid === null) return null;
  const leading = myHandle !== null && auction.highBidderHandle === myHandle;
  if (auction.status === 'open') return leading ? 'winning' : 'outbid';
  return leading && auction.outcome === 'sold' ? 'won' : 'lost';
}

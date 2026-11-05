import { inject, Injectable } from '@angular/core';
import { StatusCounts, VehicleSummary } from '../../core/api/models';
import { BidderService } from '../../core/bidder.service';
import { applyAuctionUpdate, LiveAuctionService } from '../../core/live-auction.service';

export interface InventorySnapshot {
  /** Search key + location: a snapshot only restores the exact same list. */
  key: string;
  items: VehicleSummary[];
  total: number;
  page: number;
  statusCounts: StatusCounts | null;
  savedAt: number;
}

const MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Infinite scroll's classic bug is losing your place: open lot #60, press Back,
 * land at the top with 24 results. The inventory page leaves its list here on
 * the way out and takes it back on return, so the router can restore the
 * scroll position. Live bids keep updating it in the meantime.
 */
@Injectable({ providedIn: 'root' })
export class InventorySnapshotStore {
  private readonly bidder = inject(BidderService);
  private snapshot: InventorySnapshot | null = null;

  constructor() {
    inject(LiveAuctionService).updates$.subscribe((update) => {
      if (!this.snapshot) return;
      this.snapshot = {
        ...this.snapshot,
        items: this.snapshot.items.map((item) => applyAuctionUpdate(item, update, this.bidder.handle())),
      };
    });
  }

  save(snapshot: InventorySnapshot): void {
    this.snapshot = snapshot;
  }

  /** Hands back (and forgets) the snapshot if it matches and is recent. */
  take(key: string, now = Date.now()): InventorySnapshot | null {
    const snapshot = this.snapshot;
    this.snapshot = null;
    if (!snapshot || snapshot.key !== key || now - snapshot.savedAt > MAX_AGE_MS) return null;
    return snapshot;
  }
}

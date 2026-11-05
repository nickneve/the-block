import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formatMoney, vehicleName } from '../../shared/format';
import { AuctionApi } from '../api/auction-api';
import { AuctionUpdate, VehicleSummary } from '../api/models';
import { BidderService } from '../bidder.service';
import { applyAuctionUpdate, LiveAuctionService } from '../live-auction.service';
import { ToastService } from '../toast.service';

/**
 * Every lot this buyer has bid on, kept current by live updates. It's what
 * powers the My Bids page, the header's "outbid" badge, and the outbid / won
 * notifications that follow the buyer around the app.
 */
@Injectable({ providedIn: 'root' })
export class MyBidsStore {
  private readonly api = inject(AuctionApi);
  private readonly bidder = inject(BidderService);
  private readonly live = inject(LiveAuctionService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<VehicleSummary[]>([]);
  readonly loaded = signal(false);

  readonly outbid = computed(() => this.items().filter((item) => item.myStatus === 'outbid'));
  readonly winning = computed(() => this.items().filter((item) => item.myStatus === 'winning'));
  readonly won = computed(() => this.items().filter((item) => item.myStatus === 'won'));
  readonly lost = computed(() => this.items().filter((item) => item.myStatus === 'lost'));

  start(): void {
    this.refresh();
    this.live.updates$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((update) => this.onUpdate(update));
  }

  refresh(): void {
    this.api.myBids().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  /** Called with the server's response after this tab bids or buys. */
  record(vehicle: VehicleSummary): void {
    this.items.update((items) =>
      items.some((item) => item.id === vehicle.id)
        ? items.map((item) => (item.id === vehicle.id ? vehicle : item))
        : [vehicle, ...items],
    );
  }

  private onUpdate(update: AuctionUpdate): void {
    const handle = this.bidder.handle();
    const previous = this.items().find((item) => item.id === update.vehicleId);
    if (!previous || handle === null) return;

    const next = applyAuctionUpdate(previous, update, handle);
    this.items.update((items) => items.map((item) => (item.id === next.id ? next : item)));
    this.notify(previous, next);
  }

  private notify(previous: VehicleSummary, next: VehicleSummary): void {
    if (previous.myStatus === next.myStatus) return;

    const name = vehicleName(next);
    const link = `/vehicles/${next.id}`;
    const currentBid = formatMoney(next.auction.currentBid ?? next.auction.startingBid);

    if (next.myStatus === 'outbid') {
      this.toasts.show(
        {
          tone: 'danger',
          title: "You've been outbid",
          message: `${name} · now ${currentBid}`,
          action: { label: 'Bid again', link, cta: true },
        },
        9000,
      );
    } else if (next.myStatus === 'won') {
      this.toasts.show({ tone: 'success', title: 'You won!', message: `${name} for ${currentBid}`, action: { label: 'View', link } }, 10000);
    } else if (next.myStatus === 'lost' && previous.myStatus === 'winning') {
      this.toasts.show({ tone: 'info', title: 'Auction ended', message: `Reserve wasn't met on ${name}.`, action: { label: 'View', link } });
    }
  }
}

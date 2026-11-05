import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountService } from '../../core/account.service';
import { AuctionApi } from '../../core/api/auction-api';
import { VehicleSummary } from '../../core/api/models';
import { BidderService } from '../../core/bidder.service';
import { applyAuctionUpdate, LiveAuctionService } from '../../core/live-auction.service';
import { MyBidsStore } from '../../core/state/my-bids.store';
import { WatchlistStore } from '../../core/state/watchlist.store';
import { MoneyPipe } from '../../shared/pipes';
import { MyStatusBadgeComponent } from '../../shared/ui/badges.component';
import { LotStatusComponent } from '../../shared/ui/lot-status.component';
import { VehicleImageComponent } from '../../shared/ui/vehicle-image.component';
import { WatchButtonComponent } from '../../shared/ui/watch-button.component';
import { IconComponent } from '../../shared/ui/icon.component';

const TABS = ['active', 'ended', 'watchlist'] as const;
type Tab = (typeof TABS)[number];

@Component({
  selector: 'app-my-bids-page',
  imports: [
    RouterLink,
    MoneyPipe,
    LotStatusComponent,
    MyStatusBadgeComponent,
    VehicleImageComponent,
    WatchButtonComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-bids.page.html',
  styleUrl: './my-bids.page.scss',
})
export class MyBidsPage {
  protected readonly store = inject(MyBidsStore);
  protected readonly bidder = inject(BidderService);
  private readonly watchlistStore = inject(WatchlistStore);
  private readonly api = inject(AuctionApi);
  private readonly live = inject(LiveAuctionService);
  protected readonly account = inject(AccountService).account;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** `?tab=watchlist` deep-links a tab (e.g. from the account menu). */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });
  protected readonly tab = linkedSignal<Tab>(() => {
    const param = this.tabParam();
    return TABS.includes(param as Tab) ? (param as Tab) : 'active';
  });
  private readonly watchlistItems = signal<VehicleSummary[]>([]);
  protected readonly watchlistLoaded = signal(false);

  /** Un-starring on this page removes the row straight away. */
  protected readonly watchlist = computed(() => {
    const ids = this.watchlistStore.ids();
    return this.watchlistItems().filter((item) => ids.has(item.id));
  });

  protected readonly active = computed(() => [...this.store.outbid(), ...this.store.winning()]);
  protected readonly ended = computed(() => [...this.store.won(), ...this.store.lost()]);

  protected readonly tabs = computed(() => [
    { value: 'active' as const, label: 'Bidding', count: this.active().length },
    { value: 'ended' as const, label: 'Ended', count: this.ended().length },
    { value: 'watchlist' as const, label: 'Watchlist', count: this.watchlistStore.count() },
  ]);

  protected readonly rows = computed(() => {
    switch (this.tab()) {
      case 'active':
        return this.active();
      case 'ended':
        return this.ended();
      case 'watchlist':
        return this.watchlist();
    }
  });

  constructor() {
    this.store.refresh();
    this.api.myWatchlist().subscribe({
      next: (items) => {
        this.watchlistItems.set(items);
        this.watchlistLoaded.set(true);
      },
      error: () => this.watchlistLoaded.set(true),
    });

    this.live.updates$.pipe(takeUntilDestroyed()).subscribe((update) => {
      this.watchlistItems.update((items) => items.map((item) => applyAuctionUpdate(item, update, this.bidder.handle())));
    });
  }

  protected selectTab(tab: Tab): void {
    this.tab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'active' ? null : tab },
      replaceUrl: true,
    });
  }

  protected price(item: VehicleSummary): number {
    return item.auction.currentBid ?? item.auction.startingBid;
  }
}

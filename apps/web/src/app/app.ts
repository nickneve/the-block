import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuctionApi } from './core/api/auction-api';
import { BidderService } from './core/bidder.service';
import { LiveAuctionService } from './core/live-auction.service';
import { MyBidsStore } from './core/state/my-bids.store';
import { SavedSearchesStore } from './core/state/saved-searches.store';
import { WatchlistStore } from './core/state/watchlist.store';
import { HeaderComponent } from './layout/header.component';
import { ToastsComponent } from './layout/toasts.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, ToastsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="skip-link" (click)="focusMain()">Skip to content</button>
    <app-header />
    <main #main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <footer class="footer container">
      Prototype built for the OPENLANE coding challenge · Vehicle data is synthetic · Prices in CAD
    </footer>
    <app-toasts />
  `,
  styles: `
    main {
      display: block;
      min-height: calc(100vh - var(--header-height) - 72px);
      outline: none;
    }
    .footer {
      padding-block: var(--space-5);
      border-top: 1px solid var(--border);
      color: var(--text-subtle);
      font-size: 13px;
      text-align: center;
    }
  `,
})
export class App {
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  constructor() {
    // Start the buyer's session: identity, live feed, and their bids, watchlist & saved searches.
    const bidder = inject(BidderService);
    inject(AuctionApi)
      .me()
      .subscribe({ next: ({ handle }) => bidder.handle.set(handle), error: () => undefined });
    inject(LiveAuctionService).connect();
    inject(MyBidsStore).start();
    inject(WatchlistStore).start();
    inject(SavedSearchesStore).start();
  }

  protected focusMain(): void {
    this.main().nativeElement.focus();
  }
}

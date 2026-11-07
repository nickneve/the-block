import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AccountService } from '../core/account.service';
import { LiveAuctionService } from '../core/live-auction.service';
import { MyBidsStore } from '../core/state/my-bids.store';
import { IconComponent } from '../shared/ui/icon.component';
import { AccountAvatarComponent } from './account-avatar.component';
import { AccountMenuComponent } from './account-menu.component';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, IconComponent, AccountAvatarComponent, AccountMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="container inner">
        <a routerLink="/" class="brand" aria-label="The Block, browse auctions">
          <span class="mark"><svg appIcon="gavel" [size]="18" [strokeWidth]="2.4"></svg></span>
          <span class="wordmark">The Block</span>
        </a>

        <nav class="nav" aria-label="Main">
          <a class="nav-link" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Browse</a>
          <a class="nav-link" routerLink="/my-bids" routerLinkActive="active">
            My bids
            @if (outbidCount() > 0) {
              <span class="badge tabular" [attr.aria-label]="outbidCount() + ' outbid'">{{ outbidCount() }}</span>
            }
          </a>
          <a class="nav-link nav-link--wide" routerLink="/saved-searches" routerLinkActive="active">Saved searches</a>
        </nav>

        <div class="end">
          <!-- Commented out, was used for testing purposes -->
          <!-- <span class="live" [attr.data-state]="live.connection()" [attr.title]="liveLabel()">
            <span class="dot" [class.dot--pulse]="live.connection() === 'live'"></span>
            <span class="live-label">{{ live.connection() === 'live' ? 'Live' : 'Reconnecting' }}</span>
            <span class="sr-only">{{ liveLabel() }}</span>
          </span> -->

          <!-- The menu (and the dialog code behind it) loads once the page is idle; the button looks the same before. -->
          @defer (on idle) {
            <app-account-menu />
          } @placeholder {
            <button type="button" class="account-btn" aria-label="Account menu" disabled>
              <app-account-avatar [account]="account()" />
              <svg appIcon="chevron-down" [size]="15" class="caret"></svg>
            </button>
          }
        </div>
      </div>
    </header>
  `,
  styles: `
    .header {
      position: sticky;
      top: 0;
      z-index: 30;
      height: var(--header-height);
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--bg) 85%, transparent);
      backdrop-filter: saturate(1.4) blur(12px);
    }
    .inner {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      height: 100%;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--text);
    }
    .mark {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--primary);
      color: var(--primary-contrast);
    }
    .wordmark {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .nav {
      display: flex;
      gap: var(--space-1);
      margin-left: var(--space-2);
    }
    .nav-link {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 12px;
      border-radius: var(--radius-pill);
      color: var(--text-muted);
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
      transition: color 0.15s var(--ease), background-color 0.15s var(--ease);
    }
    .nav-link:hover {
      color: var(--text);
      background: var(--surface-muted);
    }
    .nav-link.active {
      color: var(--primary);
      background: var(--primary-soft);
    }
    .badge {
      display: inline-grid;
      place-items: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: var(--radius-pill);
      background: var(--danger);
      color: var(--surface);
      font-size: 12px;
      font-weight: 700;
    }
    .end {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-left: auto;
    }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0 4px;
      height: 28px;
      color: var(--success);
      font-size: 13px;
      font-weight: 600;
    }
    .live[data-state='connecting'],
    .live[data-state='offline'] {
      color: var(--warning);
    }
    /* Mirrors the real button in AccountMenuComponent, so nothing shifts when it loads. */
    .account-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 40px;
      padding: 0 6px 0 3px;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      background: var(--surface);
      color: var(--text-muted);
    }
    @media (max-width: 860px) {
      .nav-link--wide {
        display: none;
      }
    }
    @media (max-width: 640px) {
      .inner {
        gap: var(--space-2);
      }
      .wordmark,
      .live-label,
      .caret {
        display: none;
      }
      .nav {
        margin-left: 0;
      }
      .end {
        gap: var(--space-2);
      }
      .account-btn {
        padding: 0 3px;
      }
    }
  `,
})
export class HeaderComponent {
  protected readonly live = inject(LiveAuctionService);
  private readonly myBids = inject(MyBidsStore);

  protected readonly account = inject(AccountService).account;
  protected readonly outbidCount = computed(() => this.myBids.outbid().length);
  protected readonly liveLabel = computed(() =>
    this.live.connection() === 'live' ? 'Live updates connected' : 'Reconnecting to live updates…',
  );
}

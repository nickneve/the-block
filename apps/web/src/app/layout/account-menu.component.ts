import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuGroup, CdkMenuItem, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Account, AccountService } from '../core/account.service';
import { BidderService } from '../core/bidder.service';
import { BuyerLocationService } from '../core/location.service';
import { MyBidsStore } from '../core/state/my-bids.store';
import { SavedSearchesStore } from '../core/state/saved-searches.store';
import { WatchlistStore } from '../core/state/watchlist.store';
import { ThemePreference, ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';
import { LocationDialog } from '../shared/location.dialog';
import { IconComponent } from '../shared/ui/icon.component';
import type { IconName } from '../shared/ui/icons';
import { AccountAvatarComponent } from './account-avatar.component';
import type { AuthMode } from './auth.dialog';

const MENU_BELOW_END: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
];

/**
 * The avatar button and its menu: who you are (guest or signed in), shortcuts to
 * your bids, watchlist and saved searches, location and appearance.
 * Deferred by the header, so menu and dialog code isn't in the first download.
 */
@Component({
  selector: 'app-account-menu',
  imports: [
    RouterLink,
    IconComponent,
    AccountAvatarComponent,
    CdkMenuTrigger,
    CdkMenu,
    CdkMenuItem,
    CdkMenuItemRadio,
    CdkMenuGroup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="account-btn"
      [cdkMenuTriggerFor]="accountMenu"
      [cdkMenuPosition]="menuPosition"
      [attr.aria-label]="account() ? 'Account menu, signed in as ' + account()!.name : 'Account menu, browsing as a guest'"
    >
      <app-account-avatar [account]="account()" />
      <svg appIcon="chevron-down" [size]="15" class="caret"></svg>
    </button>

    <ng-template #accountMenu>
      <div class="menu account-menu" cdkMenu>
        <div class="who">
          <app-account-avatar [account]="account()" size="lg" />
          <div class="who-text">
            @if (account(); as signedIn) {
              <p class="who-name">{{ signedIn.name }}</p>
              <p class="who-sub">{{ signedIn.dealership || signedIn.email }}</p>
            } @else {
              <p class="who-name">Guest buyer</p>
              <p class="who-sub">Not signed in</p>
            }
          </div>
        </div>
        <p class="handle">
          Other bidders see you as <strong>{{ bidder.handle() ?? '…' }}</strong>
        </p>

        @if (!account()) {
          <div class="who-actions">
            <button type="button" cdkMenuItem class="btn btn--primary btn--sm" (cdkMenuItemTriggered)="openAuth('sign-in')">
              Sign in
            </button>
            <button type="button" cdkMenuItem class="btn btn--secondary btn--sm" (cdkMenuItemTriggered)="openAuth('create')">
              Create account
            </button>
          </div>
        }

        <hr class="menu-divider" />
        <a cdkMenuItem class="menu-item" routerLink="/my-bids">
          <svg appIcon="gavel" [size]="18"></svg>
          My bids
          @if (outbidCount() > 0) {
            <span class="menu-badge menu-badge--danger">{{ outbidCount() }} outbid</span>
          }
        </a>
        <a cdkMenuItem class="menu-item" routerLink="/my-bids" [queryParams]="{ tab: 'watchlist' }">
          <svg appIcon="star" [size]="18"></svg>
          Watchlist
          <span class="menu-meta tabular">{{ watchlist.count() }}</span>
        </a>
        <a cdkMenuItem class="menu-item" routerLink="/saved-searches">
          <svg appIcon="bookmark" [size]="18"></svg>
          Saved searches
          @if (saved.newCount() > 0) {
            <span class="menu-badge">{{ saved.newCount() }} new</span>
          } @else {
            <span class="menu-meta tabular">{{ saved.count() }}</span>
          }
        </a>
        <button type="button" cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="openLocation()">
          <svg appIcon="map-pin" [size]="18"></svg>
          Location
          <span class="menu-meta">{{ location()?.label ?? 'Not set' }}</span>
        </button>

        <hr class="menu-divider" />
        <div cdkMenuGroup role="group" aria-labelledby="appearance-label">
          <span class="menu-label" id="appearance-label">Appearance</span>
          <div class="theme-switch">
            @for (option of themeOptions; track option.value) {
              <button
                type="button"
                cdkMenuItemRadio
                class="theme-option"
                [cdkMenuItemChecked]="theme.preference() === option.value"
                (cdkMenuItemTriggered)="theme.setPreference(option.value)"
              >
                <svg [appIcon]="option.icon" [size]="16"></svg>
                {{ option.label }}
              </button>
            }
          </div>
        </div>

        @if (account()) {
          <hr class="menu-divider" />
          <button type="button" cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="signOut()">
            <svg appIcon="log-out" [size]="18"></svg>
            Sign out
          </button>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: contents;
    }
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
      cursor: pointer;
      transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease);
    }
    .account-btn:hover,
    .account-btn[aria-expanded='true'] {
      border-color: var(--border-strong);
      box-shadow: var(--shadow-sm);
    }

    /* Menu content (the panel itself is styled globally as .menu) */
    .account-menu {
      width: 300px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 8px 10px 4px;
    }
    .who-text {
      min-width: 0;
    }
    .who-name {
      font-size: 15.5px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .who-sub {
      color: var(--text-muted);
      font-size: 13.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .handle {
      padding: 6px 10px 2px;
      color: var(--text-subtle);
      font-size: 13px;
    }
    .handle strong {
      color: var(--text-muted);
      font-weight: 600;
    }
    .who-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-2);
      padding: 10px 10px 6px;
    }
    .theme-switch {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin: 2px 4px 4px;
      padding: 3px;
      border-radius: var(--radius-sm);
      background: var(--surface-muted);
    }
    .theme-option {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 32px;
      border: 0;
      border-radius: 6px;
      background: none;
      color: var(--text-muted);
      font: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .theme-option:hover,
    .theme-option:focus-visible {
      color: var(--text);
      outline: none;
    }
    .theme-option:focus-visible {
      box-shadow: inset 0 0 0 2px var(--primary);
    }
    .theme-option[aria-checked='true'] {
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-sm);
    }
    @media (max-width: 640px) {
      .caret {
        display: none;
      }
      .account-btn {
        padding: 0 3px;
      }
    }
  `,
})
export class AccountMenuComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly bidder = inject(BidderService);
  protected readonly watchlist = inject(WatchlistStore);
  protected readonly saved = inject(SavedSearchesStore);
  private readonly myBids = inject(MyBidsStore);
  private readonly accounts = inject(AccountService);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(ToastService);

  protected readonly account = this.accounts.account;
  protected readonly location = inject(BuyerLocationService).location;
  protected readonly outbidCount = computed(() => this.myBids.outbid().length);
  protected readonly menuPosition = MENU_BELOW_END;
  protected readonly themeOptions: { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'system', label: 'Auto', icon: 'monitor' },
  ];

  protected async openAuth(mode: AuthMode): Promise<void> {
    // Loaded on demand: the forms code isn't needed until someone signs in.
    const { AuthDialog } = await import('./auth.dialog');
    this.dialog
      .open<Account>(AuthDialog, { data: { mode }, ariaLabelledBy: 'auth-title' })
      .closed.subscribe((account) => {
        if (!account) return;
        this.toasts.show(
          mode === 'sign-in'
            ? { tone: 'success', title: `Signed in as ${account.name}`, message: 'Welcome back.' }
            : {
                tone: 'success',
                title: `Welcome to The Block, ${account.name.split(' ')[0]}`,
                message: 'Your bids, watchlist and saved searches are now on your account.',
              },
          4000,
        );
      });
  }

  protected openLocation(): void {
    this.dialog.open(LocationDialog);
  }

  protected signOut(): void {
    this.accounts.signOut();
    this.toasts.show({ tone: 'info', title: 'Signed out', message: 'You can keep browsing and bidding as a guest.' }, 3500);
  }
}

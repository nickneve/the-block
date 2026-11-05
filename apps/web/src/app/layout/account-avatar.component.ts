import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Account, initials } from '../core/account.service';
import { IconComponent } from '../shared/ui/icon.component';

/** Initials for a signed-in buyer, a person icon for a guest. Decorative: the button around it is labelled. */
@Component({
  selector: 'app-account-avatar',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.guest]': '!account()',
    '[class.lg]': "size() === 'lg'",
  },
  template: `
    @if (account(); as signedIn) {
      {{ letters() }}
    } @else {
      <svg appIcon="user" [size]="size() === 'lg' ? 22 : 18" [strokeWidth]="2.1"></svg>
    }
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      flex: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--primary);
      color: var(--primary-contrast);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    :host(.guest) {
      background: var(--surface-muted);
      color: var(--text-muted);
    }
    :host(.lg) {
      width: 44px;
      height: 44px;
      font-size: 16px;
    }
  `,
})
export class AccountAvatarComponent {
  readonly account = input<Account | null>(null);
  readonly size = input<'md' | 'lg'>('md');

  protected readonly letters = computed(() => {
    const account = this.account();
    return account ? initials(account.name) : '';
  });
}

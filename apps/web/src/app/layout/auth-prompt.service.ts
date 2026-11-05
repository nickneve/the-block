import { Dialog } from '@angular/cdk/dialog';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Account, AccountService } from '../core/account.service';
import type { AuthDialogData, AuthMode, AuthReason } from './auth.dialog';

/**
 * Opens sign-in / create account. Browsing, watching and saving searches work
 * as a guest; committing money doesn't, so bidding asks for an account first
 * and then carries on where the buyer left off.
 */
@Injectable({ providedIn: 'root' })
export class AuthPrompt {
  private readonly accounts = inject(AccountService);
  private readonly dialog = inject(Dialog);

  /** True once someone is signed in: straight away, or after they sign in or create an account. */
  async ensureSignedIn(reason: AuthReason): Promise<boolean> {
    if (this.accounts.signedIn()) return true;
    return (await this.open('sign-in', reason)) !== undefined;
  }

  /** Resolves to the account, or undefined if the dialog was closed. */
  async open(mode: AuthMode, reason?: AuthReason): Promise<Account | undefined> {
    // Loaded on demand: the forms code isn't needed until someone signs in.
    const { AuthDialog } = await import('./auth.dialog');
    const ref = this.dialog.open<Account, AuthDialogData>(AuthDialog, {
      data: { mode, reason },
      ariaLabelledBy: 'auth-title',
    });
    return firstValueFrom(ref.closed);
  }
}

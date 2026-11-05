import { computed, Injectable, signal } from '@angular/core';

/**
 * A simulated dealer account, to show the sign-in and sign-up flow.
 *
 * There's no auth server in this prototype: signing in only records who you are in
 * this browser. Passwords are checked for shape in the form and never reach this
 * service, storage or the network. Bidding identity is still the anonymous bidder
 * id, so everything done as a guest carries over to the "account" and back.
 */
export interface Account {
  name: string;
  email: string;
  dealership: string;
}

interface StoredAccount {
  account: Account;
  signedIn: boolean;
}

export const ACCOUNT_STORAGE_KEY = 'the-block.account';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly stored = signal<StoredAccount | null>(read());

  /** The signed-in account, or null for a guest. */
  readonly account = computed(() => {
    const stored = this.stored();
    return stored?.signedIn ? stored.account : null;
  });
  readonly signedIn = computed(() => this.account() !== null);
  /** The email last used in this browser, to pre-fill the sign-in form after signing out. */
  readonly lastEmail = computed(() => this.stored()?.account.email ?? '');

  /** Signs in. An email this browser has seen before gets its name back; otherwise one is made from the address. */
  signIn(email: string): Account {
    const address = email.trim();
    const known = this.stored()?.account;
    const account =
      known && known.email.toLowerCase() === address.toLowerCase()
        ? known
        : { name: nameFromEmail(address), email: address, dealership: '' };
    this.persist({ account, signedIn: true });
    return account;
  }

  createAccount(details: Account): Account {
    const account = {
      name: details.name.trim(),
      email: details.email.trim(),
      dealership: details.dealership.trim(),
    };
    this.persist({ account, signedIn: true });
    return account;
  }

  signOut(): void {
    const stored = this.stored();
    if (stored) this.persist({ ...stored, signedIn: false });
  }

  private persist(value: StoredAccount): void {
    this.stored.set(value);
    try {
      localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage blocked: the session lasts until the tab closes.
    }
  }
}

/** "nick.la-neve42@example.com" → "Nick La Neve". */
export function nameFromEmail(email: string): string {
  const words = (email.split('@')[0] ?? '')
    .split(/[._+-]+/)
    .map((word) => word.replace(/\d+/g, ''))
    .filter(Boolean);
  return words.length ? words.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(' ') : 'Dealer';
}

/** Up to two initials for an avatar: "Nick La Neve" → "NN". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0][0] : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

function read(): StoredAccount | null {
  try {
    const value = JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY) ?? 'null') as StoredAccount | null;
    return value && typeof value.account?.email === 'string' ? value : null;
  } catch {
    return null;
  }
}

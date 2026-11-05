import { A11yModule } from '@angular/cdk/a11y';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Account, AccountService } from '../core/account.service';
import { IconComponent } from '../shared/ui/icon.component';

export type AuthMode = 'sign-in' | 'create';
/** Why the dialog opened, when something the buyer tried needs an account. */
export type AuthReason = 'bid' | 'buy_now';

export interface AuthDialogData {
  mode: AuthMode;
  reason?: AuthReason;
}

/** How long the simulated "server" takes, so the busy state is visible. */
const SIMULATED_LATENCY_MS = 700;
const MIN_PASSWORD = 8;

/**
 * Sign in / create account. A prototype flow: fields are validated like the real
 * thing, then the account is "created" in this browser. The password is checked
 * here and dropped; it never leaves this component. Resolves to the account.
 */
@Component({
  selector: 'app-auth-dialog',
  imports: [ReactiveFormsModule, A11yModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-dialog' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <header class="head">
        <div>
          <h2 id="auth-title">{{ title() }}</h2>
          <p class="lede">
            @if (reason) {
              {{ reason === 'bid' ? 'Bids are binding' : 'Buying is binding' }}, so sellers need to know which dealership
              they're dealing with. It takes a minute, and you'll go straight back to your
              {{ reason === 'bid' ? 'bid' : 'purchase' }}.
            } @else if (mode() === 'sign-in') {
              Welcome back. Your bids, watchlist and saved searches are where you left them.
            } @else {
              Bid on dealer inventory from across Canada. Everything you've done as a guest comes with you.
            }
          </p>
        </div>
        <button type="button" class="icon-btn" aria-label="Close" (click)="close()">
          <svg appIcon="x" [size]="20"></svg>
        </button>
      </header>

      <div class="switcher" role="group" aria-label="Account">
        <button type="button" [attr.aria-pressed]="mode() === 'sign-in'" (click)="setMode('sign-in')">Sign in</button>
        <button type="button" [attr.aria-pressed]="mode() === 'create'" (click)="setMode('create')">Create account</button>
      </div>

      <div class="content">
        @if (mode() === 'create') {
          <label class="field">
            <span class="label">Full name</span>
            <input class="input" type="text" formControlName="name" autocomplete="name" [attr.aria-invalid]="invalid('name')" />
            @if (invalid('name')) {
              <span class="error">Enter your name.</span>
            }
          </label>
          <label class="field">
            <span class="label">Dealership</span>
            <input
              class="input"
              type="text"
              formControlName="dealership"
              autocomplete="organization"
              [attr.aria-invalid]="invalid('dealership')"
            />
            @if (invalid('dealership')) {
              <span class="error">Enter the dealership you buy for.</span>
            }
          </label>
        }

        <label class="field">
          <span class="label">Work email</span>
          <input
            class="input"
            type="email"
            formControlName="email"
            autocomplete="email"
            inputmode="email"
            [attr.aria-invalid]="invalid('email')"
          />
          @if (invalid('email')) {
            <span class="error">Enter an email address like name&#64;dealership.ca.</span>
          }
        </label>

        <div class="field">
          <label class="label" for="auth-password">Password</label>
          <div class="password">
            <input
              id="auth-password"
              class="input"
              formControlName="password"
              [type]="showPassword() ? 'text' : 'password'"
              [attr.autocomplete]="mode() === 'sign-in' ? 'current-password' : 'new-password'"
              [attr.aria-invalid]="invalid('password')"
              aria-describedby="password-hint"
            />
            <button
              type="button"
              class="icon-btn reveal"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
              [attr.aria-pressed]="showPassword()"
              (click)="showPassword.set(!showPassword())"
            >
              <svg [appIcon]="showPassword() ? 'eye-off' : 'eye'" [size]="18"></svg>
            </button>
          </div>
          @if (invalid('password')) {
            <span class="error" id="password-hint">Use at least {{ minPassword }} characters.</span>
          } @else if (mode() === 'create') {
            <span class="hint" id="password-hint">At least {{ minPassword }} characters.</span>
          }
        </div>

        <button type="submit" class="btn btn--primary btn--lg btn--block" [disabled]="busy()">
          @if (busy()) {
            <svg appIcon="loader-circle" [size]="18" class="spin"></svg>
            {{ mode() === 'sign-in' ? 'Signing in…' : 'Creating your account…' }}
          } @else {
            {{ mode() === 'sign-in' ? 'Sign in' : 'Create account' }}
          }
        </button>
      </div>

      <footer class="foot">
        <svg appIcon="info" [size]="16"></svg>
        <p>Prototype: accounts are simulated in this browser. Your password isn't stored or sent anywhere.</p>
      </footer>
    </form>
  `,
  styles: `
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-5) var(--space-4) 0 var(--space-5);
    }
    h2 {
      font-size: 22px;
    }
    .lede {
      margin-top: var(--space-1);
      color: var(--text-muted);
      font-size: 14.5px;
    }
    .switcher {
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin: var(--space-4) var(--space-5) 0;
      padding: 3px;
      border-radius: var(--radius-sm);
      background: var(--surface-muted);
    }
    .switcher button {
      height: 34px;
      border: 0;
      border-radius: 6px;
      background: none;
      color: var(--text-muted);
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .switcher button[aria-pressed='true'] {
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-sm);
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5) var(--space-5);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .label {
      font-size: 14px;
      font-weight: 600;
    }
    .input[aria-invalid='true'] {
      border-color: var(--danger);
    }
    .error {
      color: var(--danger);
      font-size: 13px;
    }
    .hint {
      color: var(--text-subtle);
      font-size: 13px;
    }
    .password {
      position: relative;
    }
    .password .input {
      padding-right: 48px;
    }
    .reveal {
      position: absolute;
      top: 50%;
      right: 4px;
      transform: translateY(-50%);
    }
    .foot {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-5) var(--space-4);
      border-top: 1px solid var(--border);
      color: var(--text-subtle);
      font-size: 13px;
    }
    .foot svg {
      flex: none;
      margin-top: 1px;
    }
    .spin {
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class AuthDialog {
  private readonly data = inject<AuthDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<Account>>(DialogRef);
  private readonly accounts = inject(AccountService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly mode = signal<AuthMode>(this.data.mode);
  protected readonly reason = this.data.reason;
  protected readonly title = computed(() => {
    const action = this.reason === 'buy_now' ? 'buy' : 'bid';
    if (this.mode() === 'sign-in') return this.reason ? `Sign in to ${action}` : 'Sign in';
    return this.reason ? `Create an account to ${action}` : 'Create your account';
  });
  protected readonly busy = signal(false);
  protected readonly showPassword = signal(false);
  private readonly submitted = signal(false);
  protected readonly minPassword = MIN_PASSWORD;

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    dealership: ['', Validators.required],
    email: [this.accounts.lastEmail(), [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD)]],
  });

  /** Name and dealership only count when creating an account. */
  private readonly fields = computed(() =>
    this.mode() === 'create' ? (['name', 'dealership', 'email', 'password'] as const) : (['email', 'password'] as const),
  );

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected setMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.submitted.set(false);
  }

  protected invalid(field: 'name' | 'dealership' | 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  protected submit(): void {
    this.submitted.set(true);
    const fields = this.fields();
    if (fields.some((field) => this.form.controls[field].invalid) || this.busy()) return;

    const { name, dealership, email } = this.form.getRawValue();
    this.busy.set(true);
    // Stand-in for the network round trip. Only the profile is passed on, never the password.
    this.timer = setTimeout(() => {
      const account =
        this.mode() === 'sign-in'
          ? this.accounts.signIn(email)
          : this.accounts.createAccount({ name, dealership, email });
      this.dialogRef.close(account);
    }, SIMULATED_LATENCY_MS);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}

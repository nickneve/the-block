import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * One shared 1-second tick for every countdown on screen, instead of a timer
 * per card. Components derive remaining time with `computed()` from `now`.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  readonly now = signal(Date.now());

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}

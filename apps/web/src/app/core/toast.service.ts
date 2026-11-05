import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'danger' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  /** Optional call to action, e.g. "Bid again" → /vehicles/:id. `cta` marks a bidding action (orange). */
  action?: { label: string; link: string; queryParams?: Record<string, string>; cta?: boolean };
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(toast: Omit<Toast, 'id'>, durationMs = 6000): void {
    const id = this.nextId++;
    // Newest on top; cap the stack so a busy auction can't flood the screen.
    this.toasts.update((toasts) => [{ ...toast, id }, ...toasts].slice(0, 4));
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }
}

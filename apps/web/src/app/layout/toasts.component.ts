import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/ui/icon.component';

@Component({
  selector: 'app-toasts',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite" aria-relevant="additions">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [attr.data-tone]="toast.tone" role="status">
          <span class="icon" aria-hidden="true">
            @switch (toast.tone) {
              @case ('success') {
                <svg appIcon="circle-check" [size]="20" [strokeWidth]="2.2"></svg>
              }
              @case ('danger') {
                <svg appIcon="circle-exclamation-point" [size]="20" [strokeWidth]="2.2"></svg>
              }
              @default {
                <svg appIcon="info" [size]="20" [strokeWidth]="2.2"></svg>
              }
            }
          </span>
          <div class="text">
            <strong>{{ toast.title }}</strong>
            @if (toast.message) {
              <span>{{ toast.message }}</span>
            }
          </div>
          @if (toast.action; as action) {
            <a
              class="btn btn--sm"
              [class.btn--cta]="action.cta"
              [class.btn--secondary]="!action.cta"
              [routerLink]="action.link"
              [queryParams]="action.queryParams"
              (click)="toasts.dismiss(toast.id)"
            >
              {{ action.label }}
            </a>
          }
          <button type="button" class="icon-btn close" aria-label="Dismiss" (click)="toasts.dismiss(toast.id)">
            <svg appIcon="x" [size]="16"></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      top: calc(var(--header-height) + var(--space-3));
      left: var(--space-4);
      right: var(--space-4);
      z-index: 60;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      pointer-events: none;
    }
    @media (min-width: 768px) {
      .toasts {
        top: auto;
        bottom: var(--space-5);
        left: auto;
        right: var(--space-5);
        width: 400px;
        flex-direction: column-reverse;
      }
    }
    .toast {
      --tone: var(--primary);
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-2) var(--space-3) var(--space-4);
      border: 1px solid var(--border);
      border-left: 4px solid var(--tone);
      border-radius: var(--radius-md);
      background: var(--surface);
      box-shadow: var(--shadow-lg);
      pointer-events: auto;
      animation: toast-in 0.22s var(--ease);
    }
    .toast[data-tone='success'] {
      --tone: var(--success);
    }
    .toast[data-tone='danger'] {
      --tone: var(--danger);
    }
    .icon {
      display: grid;
      color: var(--tone);
    }
    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      font-size: 14px;
    }
    .text span {
      color: var(--text-muted);
    }
    .close {
      width: 32px;
      height: 32px;
      flex: none;
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class ToastsComponent {
  protected readonly toasts = inject(ToastService);
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container wrap">
      <p class="eyebrow">404</p>
      <h1>We couldn't find that page</h1>
      <p class="muted">The link may be out of date. The auctions are still running, though.</p>
      <a class="btn btn--primary" routerLink="/">Browse auctions</a>
    </div>
  `,
  styles: `
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding-block: var(--space-8);
      text-align: center;
    }
    h1 {
      font-size: 28px;
    }
    .btn {
      margin-top: var(--space-3);
    }
  `,
})
export class NotFoundPage {}

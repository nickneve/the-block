import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MyBidStatus, ReserveStatus } from '../../core/api/models';
import { IconComponent } from './icon.component';

/**
 * Salvage and rebuilt titles materially change a vehicle's value — never let them hide.
 * In dense lists a clean title is shown quietly so the problem titles stand out.
 */
@Component({
  selector: 'app-title-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (status()) {
      @case ('salvage') {
        <span class="chip chip--danger"><svg appIcon="triangle-exclamation-point" [size]="13" [strokeWidth]="2.4"></svg>Salvage title</span>
      }
      @case ('rebuilt') {
        <span class="chip chip--warning"><svg appIcon="triangle-exclamation-point" [size]="13" [strokeWidth]="2.4"></svg>Rebuilt title</span>
      }
      @default {
        @if (showClean()) {
          <span class="chip" [class.chip--success]="cleanTone() === 'success'">
            <svg appIcon="shield-check" [size]="13" [strokeWidth]="2.4"></svg>Clean title
          </span>
        }
      }
    }
  `,
  styles: ':host { display: contents; }',
})
export class TitleBadgeComponent {
  readonly status = input.required<string>();
  readonly showClean = input(false);
  readonly cleanTone = input<'success' | 'quiet'>('success');
}

/** Reserve amounts stay private; buyers only learn whether it's been met. */
@Component({
  selector: 'app-reserve-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (status()) {
      @case ('met') {
        <span class="chip chip--success">Reserve met</span>
      }
      @case ('not_met') {
        <span class="chip">Reserve not met</span>
      }
      @default {
        <span class="chip chip--primary">No reserve</span>
      }
    }
  `,
  styles: ':host { display: contents; }',
})
export class ReserveBadgeComponent {
  readonly status = input.required<ReserveStatus>();
}

@Component({
  selector: 'app-my-status-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (status()) {
      @case ('winning') {
        <span class="chip chip--success"><svg appIcon="circle-check" [size]="13" [strokeWidth]="2.4"></svg>You're winning</span>
      }
      @case ('outbid') {
        <span class="chip chip--danger"><svg appIcon="circle-exclamation-point" [size]="13" [strokeWidth]="2.4"></svg>Outbid</span>
      }
      @case ('won') {
        <span class="chip chip--success"><svg appIcon="trophy" [size]="13" [strokeWidth]="2.4"></svg>You won</span>
      }
      @case ('lost') {
        <span class="chip">Didn't win</span>
      }
    }
  `,
  styles: ':host { display: contents; }',
})
export class MyStatusBadgeComponent {
  readonly status = input.required<MyBidStatus | null>();
}

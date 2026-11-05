import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AuctionState } from '../../core/api/models';
import { ClockService } from '../../core/clock.service';
import { formatRemaining, urgency } from '../time';
import { IconComponent } from './icon.component';

/**
 * The lot's state at a glance: a live countdown while open (calm → amber under
 * an hour → red in the final five minutes), or how it ended.
 */
@Component({
  selector: 'app-lot-status',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auction().status === 'open') {
      <span class="chip" [class]="openClass()" [attr.aria-label]="'Closes in ' + remaining()">
        @if (tone() === 'calm') {
          <svg appIcon="clock" [size]="13" [strokeWidth]="2.4"></svg>
        } @else {
          <span class="dot dot--pulse"></span>
        }
        <span class="tabular">{{ remaining() }}</span>
        @if (auction().extended) {
          <span class="extended">· extended</span>
        }
      </span>
    } @else {
      <span class="chip" [class]="endedClass()">
        @if (auction().outcome === 'sold') {
          <svg appIcon="badge-check" [size]="13" [strokeWidth]="2.4"></svg>
        } @else {
          <svg appIcon="circle-x" [size]="13" [strokeWidth]="2.4"></svg>
        }
        {{ endedLabel() }}
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .extended {
      font-weight: 500;
      opacity: 0.85;
    }
  `,
})
export class LotStatusComponent {
  readonly auction = input.required<AuctionState>();
  /** "overlay" sits on top of a photo; "plain" sits on a surface. */
  readonly variant = input<'overlay' | 'plain'>('plain');

  private readonly clock = inject(ClockService);

  private readonly remainingMs = computed(() => Date.parse(this.auction().closesAt) - this.clock.now());
  protected readonly remaining = computed(() => formatRemaining(this.remainingMs()));
  protected readonly tone = computed(() => urgency(this.remainingMs()));

  protected readonly openClass = computed(() => {
    const tone = this.tone();
    if (tone === 'urgent') return 'chip chip--danger';
    if (tone === 'soon') return 'chip chip--warning';
    return this.variant() === 'overlay' ? 'chip chip--overlay' : 'chip';
  });

  protected readonly endedClass = computed(() => {
    if (this.variant() === 'overlay') return 'chip chip--overlay';
    return this.auction().outcome === 'sold' ? 'chip chip--primary' : 'chip';
  });

  protected readonly endedLabel = computed(() => {
    const { outcome, soldViaBuyNow } = this.auction();
    if (outcome === 'sold') return soldViaBuyNow ? 'Sold · Buy Now' : 'Sold';
    if (outcome === 'reserve_not_met') return 'Reserve not met';
    return 'No sale';
  });
}

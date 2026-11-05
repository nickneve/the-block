import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VehicleSummary } from '../../core/api/models';
import { ClockService } from '../../core/clock.service';
import { formatDistance } from '../../shared/format';
import { bidCountLabel, displayPrice, priceLabel, reservePill } from '../../shared/lot-view';
import { KmPipe, MoneyPipe, ProvincePipe } from '../../shared/pipes';
import { isNewListing } from '../../shared/time';
import { MyStatusBadgeComponent, TitleBadgeComponent } from '../../shared/ui/badges.component';
import { ConditionGradeComponent } from '../../shared/ui/condition-grade.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { LotStatusComponent } from '../../shared/ui/lot-status.component';
import { VehicleImageComponent } from '../../shared/ui/vehicle-image.component';
import { WatchButtonComponent } from '../../shared/ui/watch-button.component';

/** Photo-first lot card for the grid view. */
@Component({
  selector: 'app-vehicle-card',
  imports: [
    RouterLink,
    KmPipe,
    MoneyPipe,
    ProvincePipe,
    VehicleImageComponent,
    LotStatusComponent,
    WatchButtonComponent,
    ConditionGradeComponent,
    TitleBadgeComponent,
    MyStatusBadgeComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehicle-card.component.html',
  styleUrl: './vehicle-card.component.scss',
})
export class VehicleCardComponent {
  readonly vehicle = input.required<VehicleSummary>();

  private readonly clock = inject(ClockService);

  protected readonly title = computed(() => {
    const { year, make, model } = this.vehicle();
    return `${year} ${make} ${model}`;
  });

  /** "Current bid · 5 bids", "Starting bid", "Sold for". */
  protected readonly priceTagLabel = computed(() => {
    const { auction } = this.vehicle();
    const label = priceLabel(auction);
    return auction.status === 'open' && auction.bidCount > 0 ? `${label} · ${bidCountLabel(auction.bidCount)}` : label;
  });
  protected readonly price = computed(() => displayPrice(this.vehicle().auction));
  protected readonly reserve = computed(() => reservePill(this.vehicle().auction));
  protected readonly distance = computed(() => {
    const { distanceKm, distanceBasis } = this.vehicle();
    return distanceKm === null ? null : formatDistance(distanceKm, distanceBasis);
  });
  protected readonly isNew = computed(
    () => this.vehicle().auction.status === 'open' && isNewListing(this.vehicle().listedAt, this.clock.now()),
  );
}

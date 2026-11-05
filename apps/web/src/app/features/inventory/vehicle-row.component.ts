import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VehicleSummary } from '../../core/api/models';
import { ClockService } from '../../core/clock.service';
import { formatDateTime, formatDistance, humanize } from '../../shared/format';
import { bidCountLabel, displayPrice, priceLabel, reservePill } from '../../shared/lot-view';
import { KmPipe, MoneyPipe, ProvincePipe } from '../../shared/pipes';
import { isNewListing } from '../../shared/time';
import { MyStatusBadgeComponent, TitleBadgeComponent } from '../../shared/ui/badges.component';
import { ConditionGradeComponent } from '../../shared/ui/condition-grade.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { LotStatusComponent } from '../../shared/ui/lot-status.component';
import { VehicleImageComponent } from '../../shared/ui/vehicle-image.component';
import { WatchButtonComponent } from '../../shared/ui/watch-button.component';

/**
 * Data-dense lot row for the list view — the wholesale-dealer way of scanning
 * a sale: vehicle, condition, where and when, and price in fixed columns.
 * The title is the link (stretched over the row) so the row's own buttons stay valid.
 */
@Component({
  selector: 'app-vehicle-row',
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
  templateUrl: './vehicle-row.component.html',
  styleUrl: './vehicle-row.component.scss',
})
export class VehicleRowComponent {
  readonly vehicle = input.required<VehicleSummary>();

  private readonly clock = inject(ClockService);

  protected readonly title = computed(() => {
    const { year, make, model } = this.vehicle();
    return `${year} ${make} ${model}`;
  });
  protected readonly priceLabel = computed(() => priceLabel(this.vehicle().auction));
  protected readonly price = computed(() => displayPrice(this.vehicle().auction));
  protected readonly bids = computed(() => bidCountLabel(this.vehicle().auction.bidCount));
  protected readonly reserve = computed(() => reservePill(this.vehicle().auction));
  protected readonly closesAt = computed(() => formatDateTime(this.vehicle().auction.closesAt));
  protected readonly drive = computed(() => {
    const { transmission, drivetrain } = this.vehicle();
    return `${humanize(transmission)} · ${drivetrain}`;
  });
  protected readonly damage = computed(() => {
    const count = this.vehicle().damageCount;
    return count === 0 ? 'None reported' : `${count} ${count === 1 ? 'note' : 'notes'}`;
  });
  protected readonly distance = computed(() => {
    const { distanceKm, distanceBasis } = this.vehicle();
    return distanceKm === null ? null : formatDistance(distanceKm, distanceBasis);
  });
  protected readonly isNew = computed(
    () => this.vehicle().auction.status === 'open' && isNewListing(this.vehicle().listedAt, this.clock.now()),
  );
  protected readonly titleLabel = computed(() => `${humanize(this.vehicle().titleStatus)} title`);
  protected readonly fuel = computed(() => humanize(this.vehicle().fuelType));
}

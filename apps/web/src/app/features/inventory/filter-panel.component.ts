import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Facets, StatusCounts } from '../../core/api/models';
import { HumanizePipe, MoneyPipe } from '../../shared/pipes';
import { FlagFilter, InventoryQuery, ListFilter, NumberFilter, StatusTab } from './inventory-query';

const COLLAPSED_MAKES = 6;

@Component({
  selector: 'app-filter-panel',
  imports: [HumanizePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss',
})
export class FilterPanelComponent {
  readonly facets = input.required<Facets | null>();
  readonly query = input.required<InventoryQuery>();
  /** Lots per status, honouring the other filters (from the latest search). */
  readonly statusCounts = input<StatusCounts | null>(null);
  readonly queryChange = output<InventoryQuery>();

  protected readonly statusOptions: { value: StatusTab; label: string; count: keyof StatusCounts }[] = [
    { value: 'open', label: 'Open for bidding', count: 'open' },
    { value: 'closing_soon', label: 'Closing in 24 hours', count: 'closingSoon' },
    { value: 'ended', label: 'Ended', count: 'ended' },
  ];
  protected readonly flagOptions: { key: FlagFilter; label: string; count: keyof Facets['flags'] }[] = [
    { key: 'buyNow', label: 'Buy Now available', count: 'buyNow' },
    { key: 'noReserve', label: 'No reserve', count: 'noReserve' },
    { key: 'watched', label: 'In my watchlist', count: 'watched' },
  ];
  protected readonly checkGroups = [
    { key: 'titleStatus', facet: 'titleStatuses', label: 'Title status' },
    { key: 'province', facet: 'provinces', label: 'Province' },
  ] as const;

  protected readonly showAllMakes = signal(false);

  protected readonly visibleMakes = computed(() => {
    const makes = this.facets()?.makes ?? [];
    const selected = this.query().make;
    if (this.showAllMakes()) return makes;
    // The most common makes for the current filters (none with zero matches), plus any already ticked.
    const popular = [...makes]
      .filter((make) => make.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, COLLAPSED_MAKES);
    return makes.filter((make) => popular.includes(make) || selected.includes(make.value));
  });

  protected readonly priceOptions = [10_000, 20_000, 30_000, 50_000, 75_000];
  protected readonly kmOptions = [25_000, 50_000, 100_000, 150_000];
  protected readonly gradeOptions = [
    { value: 4.5, label: '4.5+ Excellent' },
    { value: 3.5, label: '3.5+ Good or better' },
    { value: 2.5, label: '2.5+ Fair or better' },
  ];
  protected readonly yearOptions = computed(() => {
    const newest = this.facets()?.year.max ?? new Date().getFullYear();
    return [1, 3, 5, 7].map((age) => newest - age);
  });

  protected has(key: ListFilter, value: string): boolean {
    return this.query()[key].includes(value);
  }

  protected toggle(key: ListFilter, value: string): void {
    const current = this.query()[key];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    this.emit({ [key]: next });
  }

  protected setStatus(status: StatusTab): void {
    this.emit({ status });
  }

  protected setFlag(key: FlagFilter, event: Event): void {
    this.emit({ [key]: (event.target as HTMLInputElement).checked });
  }

  protected setNumber(key: NumberFilter, event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.emit({ [key]: raw === '' ? null : Number(raw) });
  }

  private emit(patch: Partial<InventoryQuery>): void {
    this.queryChange.emit({ ...this.query(), ...patch });
  }
}

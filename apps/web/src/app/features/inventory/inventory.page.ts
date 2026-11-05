import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { AuctionApi, toApiError } from '../../core/api/auction-api';
import { SavedSearch, StatusCounts, VehicleSummary } from '../../core/api/models';
import { BidderService } from '../../core/bidder.service';
import { applyAuctionUpdate, LiveAuctionService } from '../../core/live-auction.service';
import { BuyerLocationService } from '../../core/location.service';
import { SavedSearchesStore } from '../../core/state/saved-searches.store';
import { ToastService } from '../../core/toast.service';
import { LocationDialog } from '../../shared/location.dialog';
import { IconComponent } from '../../shared/ui/icon.component';
import { InViewDirective } from '../../shared/ui/in-view.directive';
import { SaveSearchData, SaveSearchDialog } from '../saved-searches/save-search.dialog';
import { FilterPanelComponent } from './filter-panel.component';
import { InventorySnapshotStore } from './inventory-snapshot.store';
import {
  activeFilterCount,
  activeQuickSort,
  AppliedFilter,
  appliedFilters,
  applyQuickSort,
  applySort,
  clearFilters,
  DEFAULT_QUERY,
  describeQuery,
  InventoryQuery,
  isDefaultQuery,
  MORE_SORTS,
  parseInventoryQuery,
  QUICK_SORTS,
  QuickSortId,
  searchKey,
  SortKey,
  sortLabel,
  suggestSearchName,
  toRouteParams,
} from './inventory-query';
import { VehicleCardComponent } from './vehicle-card.component';
import { VehicleRowComponent } from './vehicle-row.component';

const PAGE_SIZE = 24;
/** Start fetching the next page this far before the end of the list scrolls into view. */
const PREFETCH_MARGIN_PX = 900;
const VIEW_STORAGE_KEY = 'the-block.inventory-view';
type ViewMode = 'grid' | 'list';

/** One entry in a sort menu: a quick-sort tab or one of the longer-tail sorts. */
interface SortChoice {
  key: string;
  label: string;
  quick?: QuickSortId;
  sort?: SortKey;
  dividerBefore?: boolean;
}

const QUICK_CHOICES: SortChoice[] = QUICK_SORTS.map((option) => ({ key: option.id, label: option.label, quick: option.id }));
const MORE_CHOICES: SortChoice[] = MORE_SORTS.map((option) => ({ key: option.value, label: option.label, sort: option.value }));

const MENU_BELOW_START: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
];
const MENU_BELOW_END: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
];

@Component({
  selector: 'app-inventory-page',
  imports: [
    CdkTrapFocus,
    CdkMenu,
    CdkMenuItem,
    CdkMenuItemRadio,
    CdkMenuTrigger,
    NgTemplateOutlet,
    RouterLink,
    FilterPanelComponent,
    VehicleCardComponent,
    VehicleRowComponent,
    IconComponent,
    InViewDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory.page.html',
  styleUrl: './inventory.page.scss',
  host: { '(document:keydown.escape)': 'filtersOpen.set(false)' },
})
export class InventoryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AuctionApi);
  private readonly live = inject(LiveAuctionService);
  private readonly bidder = inject(BidderService);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(ToastService);
  private readonly snapshots = inject(InventorySnapshotStore);
  private readonly locationService = inject(BuyerLocationService);
  private readonly injector = inject(Injector);
  protected readonly saved = inject(SavedSearchesStore);

  readonly query = toSignal(this.route.queryParams.pipe(map(parseInventoryQuery)), { initialValue: DEFAULT_QUERY });
  readonly location = this.locationService.location;

  /**
   * Filter options with counts for the current search. Sorting doesn't change the
   * counts, so only a change of filters refetches; the last good set stays up meanwhile.
   */
  readonly facets = toSignal(
    toObservable(this.query).pipe(
      map((query) => ({ query, key: searchKey({ ...query, sort: DEFAULT_QUERY.sort }) })),
      distinctUntilChanged((a, b) => a.key === b.key),
      switchMap(({ query }) => this.api.facets(query).pipe(catchError(() => EMPTY))),
    ),
    { initialValue: null },
  );
  /** The whole auction by status, for the summary under the title. */
  readonly totals = computed(() => this.facets()?.totals ?? null);

  readonly items = signal<VehicleSummary[]>([]);
  readonly total = signal(0);
  readonly statusCounts = signal<StatusCounts | null>(null);
  /** "refreshing" keeps the current results on screen (dimmed) while a new search loads. */
  readonly state = signal<'loading' | 'refreshing' | 'ready' | 'error'>('loading');
  readonly loadingMore = signal(false);
  readonly loadMoreFailed = signal(false);
  readonly filtersOpen = signal(false);
  readonly searchInput = signal('');
  readonly view = signal<ViewMode>(loadView());

  readonly applied = computed(() => appliedFilters(this.query()));
  readonly activeFilters = computed(() => activeFilterCount(this.query()));
  readonly hasMore = computed(() => this.items().length < this.total());
  readonly activeQuick = computed(() => activeQuickSort(this.query()));
  readonly moreSortActive = computed(() => this.activeQuick() === null);
  readonly currentSortLabel = computed(() => sortLabel(this.query()));
  readonly canSave = computed(() => !isDefaultQuery(this.query()));
  readonly savedForQuery = computed(() => (this.saved.loaded() ? this.saved.find(this.query()) : undefined));

  readonly quickSorts = QUICK_SORTS;
  readonly moreChoices = MORE_CHOICES;
  readonly allChoices: SortChoice[] = [
    ...QUICK_CHOICES,
    ...MORE_CHOICES.map((choice, index) => ({ ...choice, dividerBefore: index === 0 })),
  ];
  readonly menuBelowStart = MENU_BELOW_START;
  readonly menuBelowEnd = MENU_BELOW_END;
  readonly pageSize = PAGE_SIZE;
  readonly prefetchMargin = `0px 0px ${PREFETCH_MARGIN_PX}px 0px`;

  /** Identity of the list on screen: the search plus the location distances were computed from. */
  private readonly listKey = computed(() => {
    const location = this.location();
    return `${searchKey(this.query())}@${location ? `${location.lat},${location.lng}` : ''}`;
  });

  private page = 1;
  private lastPushedSearch = '';
  private skipFetchFor: string | null = null;
  private readonly retry$ = new Subject<void>();
  private readonly searchChanges$ = new Subject<string>();
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  private readonly resultsTop = viewChild<ElementRef<HTMLElement>>('resultsTop');

  constructor() {
    this.restoreSnapshot();

    // Results follow the URL (and the buyer's location): any change refetches page 1.
    toObservable(this.listKey)
      .pipe(
        // Coming back to a list we kept? Show it as-is instead of refetching.
        filter((key) => {
          const skip = key === this.skipFetchFor;
          this.skipFetchFor = null;
          return !skip;
        }),
        // "Retry" after an error re-runs the current query.
        switchMap(() => this.retry$.pipe(startWith(undefined))),
        map(() => this.query()),
        tap(() => {
          // Keep what's on screen while the new results load, rather than flashing skeletons.
          const hasResults = this.items().length > 0 && this.state() !== 'error';
          this.state.set(hasResults ? 'refreshing' : 'loading');
          this.page = 1;
          this.loadingMore.set(false);
          this.loadMoreFailed.set(false);
        }),
        switchMap((query) =>
          this.api.search(query, 1, PAGE_SIZE).pipe(
            catchError(() => {
              this.state.set('error');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        const refreshed = this.state() === 'refreshing';
        this.items.set(page.items);
        this.total.set(page.total);
        this.statusCounts.set(page.statusCounts);
        this.state.set('ready');
        if (refreshed) this.revealResults();
      });

    // Typing updates the URL after a short pause (replaceUrl: no history entry per keystroke).
    this.searchChanges$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe((text) => {
      this.lastPushedSearch = text.trim();
      this.navigate({ ...this.query(), q: text }, true);
    });

    // Keep the search box in sync when the URL changes from elsewhere (back button, chips, saved search).
    effect(() => {
      const q = this.query().q;
      if (q !== this.lastPushedSearch) {
        this.lastPushedSearch = q;
        this.searchInput.set(q);
      }
    });

    // Live bids update lots in place.
    this.live.updates$.pipe(takeUntilDestroyed()).subscribe((update) => {
      this.items.update((items) => items.map((item) => applyAuctionUpdate(item, update, this.bidder.handle())));
    });

    // Lock page scroll while the mobile filter sheet is open.
    effect(() => this.document.body.classList.toggle('scroll-locked', this.filtersOpen()));

    // Match counts on saved searches move as lots open, close and get listed; refresh on each visit.
    if (this.saved.loaded()) this.saved.refresh();

    inject(DestroyRef).onDestroy(() => this.saveSnapshot());
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    this.searchChanges$.next(value);
  }

  clearSearch(): void {
    this.searchInput.set('');
    this.lastPushedSearch = '';
    this.navigate({ ...this.query(), q: '' });
  }

  selectQuickSort(id: QuickSortId): void {
    if (id === 'distance' && !this.location()) {
      // Distance needs a location first; sort once the buyer has set one.
      this.openLocation(() => this.navigate(applyQuickSort(this.query(), id)));
      return;
    }
    this.navigate(applyQuickSort(this.query(), id));
  }

  chooseSort(choice: SortChoice): void {
    if (choice.quick) this.selectQuickSort(choice.quick);
    else if (choice.sort) this.navigate(applySort(this.query(), choice.sort));
  }

  isChoiceActive(choice: SortChoice): boolean {
    return choice.quick ? this.activeQuick() === choice.quick : !this.activeQuick() && this.query().sort === choice.sort;
  }

  setView(view: ViewMode): void {
    this.view.set(view);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  }

  openLocation(onSet?: () => void): void {
    this.dialog.open<boolean>(LocationDialog).closed.subscribe((changed) => {
      if (changed) onSet?.();
    });
  }

  toggleSave(): void {
    const existing = this.savedForQuery();
    if (existing) {
      this.saved.remove(existing);
      this.toasts.show({ tone: 'info', title: 'Removed from saved searches', message: existing.name }, 3500);
      return;
    }

    const query = this.query();
    const ref = this.dialog.open<string, SaveSearchData>(SaveSearchDialog, {
      data: { suggestedName: suggestSearchName(query), summary: describeQuery(query) },
    });
    ref.closed.pipe(filter((name): name is string => !!name)).subscribe((name) => {
      this.saved.save(name, query).subscribe({
        next: (saved) =>
          this.toasts.show(
            {
              tone: 'success',
              title: 'Search saved',
              message: `${saved.name} · ${saved.matchCount} ${saved.matchCount === 1 ? 'match' : 'matches'} right now`,
              action: { label: 'View saved searches', link: '/saved-searches' },
            },
            5000,
          ),
        error: (error: unknown) =>
          this.toasts.show({ tone: 'danger', title: "Couldn't save that search", message: toApiError(error).message }),
      });
    });
  }

  applySaved(saved: SavedSearch): void {
    this.navigate(parseInventoryQuery(saved.query));
  }

  isActiveSaved(saved: SavedSearch): boolean {
    return this.savedForQuery()?.id === saved.id;
  }

  applyFilters(query: InventoryQuery): void {
    this.navigate(query);
  }

  removeFilter(chip: AppliedFilter): void {
    if (chip.id === 'q') {
      this.searchInput.set('');
      this.lastPushedSearch = '';
    }
    this.navigate(chip.without);
  }

  /** The sidebar's "Clear all": filters only, the search text stays. */
  clearAllFilters(): void {
    this.navigate(clearFilters(this.query()));
  }

  /** Clears everything shown as a chip, search text included. */
  resetFilters(): void {
    this.searchInput.set('');
    this.lastPushedSearch = '';
    this.navigate({ ...clearFilters(this.query()), q: '' });
  }

  retry(): void {
    this.retry$.next();
  }

  /** Infinite scroll: the end-of-list sentinel came within reach of the viewport. */
  onSentinel(visible: boolean): void {
    if (visible) this.loadMore();
  }

  retryLoadMore(): void {
    this.loadMoreFailed.set(false);
    this.loadMore();
  }

  scrollToTop(): void {
    this.document.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private loadMore(): void {
    if (this.loadingMore() || this.loadMoreFailed() || !this.hasMore() || this.state() !== 'ready') return;
    const key = this.listKey();
    this.loadingMore.set(true);
    this.api.search(this.query(), this.page + 1, PAGE_SIZE).subscribe({
      next: (page) => {
        if (key !== this.listKey()) return; // the search changed while this page was in flight
        this.page += 1;
        // A live bid can reshuffle "closing"/"price" order between pages; never show a lot twice.
        this.items.update((items) => {
          const seen = new Set(items.map((item) => item.id));
          return [...items, ...page.items.filter((item) => !seen.has(item.id))];
        });
        this.total.set(page.total);
        this.loadingMore.set(false);
        // The observer only reports changes, so on a very tall screen the sentinel may still be in
        // reach after this page renders — check its real position and keep filling if so.
        afterNextRender(() => this.sentinelInReach() && this.loadMore(), { injector: this.injector });
      },
      error: () => {
        this.loadingMore.set(false);
        this.loadMoreFailed.set(true);
      },
    });
  }

  private sentinelInReach(): boolean {
    const element = this.sentinel()?.nativeElement;
    const viewport = this.document.defaultView?.innerHeight ?? 0;
    return !!element && element.getBoundingClientRect().top < viewport + PREFETCH_MARGIN_PX;
  }

  /**
   * After a filter change from deep in the list (the sidebar is sticky), bring the
   * top of the new results into view instead of leaving the buyer mid-way down.
   */
  private revealResults(): void {
    const element = this.resultsTop()?.nativeElement;
    const view = this.document.defaultView;
    if (!element || !view) return;
    const headerHeight = parseFloat(getComputedStyle(this.document.documentElement).getPropertyValue('--header-height')) || 64;
    const top = element.getBoundingClientRect().top;
    if (top < headerHeight) view.scrollTo({ top: view.scrollY + top - headerHeight - 12, behavior: 'smooth' });
  }

  private restoreSnapshot(): void {
    const snapshot = this.snapshots.take(this.listKey());
    if (!snapshot) return;
    this.items.set(snapshot.items);
    this.total.set(snapshot.total);
    this.statusCounts.set(snapshot.statusCounts);
    this.page = snapshot.page;
    this.state.set('ready');
    this.skipFetchFor = snapshot.key;
  }

  private saveSnapshot(): void {
    if (this.state() !== 'ready' || this.items().length === 0) return;
    this.snapshots.save({
      key: this.listKey(),
      items: this.items(),
      total: this.total(),
      page: this.page,
      statusCounts: this.statusCounts(),
      savedAt: Date.now(),
    });
  }

  /**
   * Filters and sorts change only the query string. The router would jump to the top of the
   * page each time; instead the page stays put, and revealResults() scrolls only if the
   * results header has scrolled out of view.
   */
  private navigate(query: InventoryQuery, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toRouteParams(query),
      replaceUrl,
      scroll: 'manual',
    });
  }
}

function loadView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

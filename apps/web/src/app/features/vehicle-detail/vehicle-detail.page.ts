import { Location } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, startWith, Subject, switchMap } from 'rxjs';
import { AuctionApi } from '../../core/api/auction-api';
import { AuctionUpdate, Bid, VehicleDetail } from '../../core/api/models';
import { BidderService } from '../../core/bidder.service';
import { applyAuctionUpdate, LiveAuctionService } from '../../core/live-auction.service';
import { ToastService } from '../../core/toast.service';
import { ClockService } from '../../core/clock.service';
import { formatAge, formatDateTime, formatDay, formatDistance, vehicleName } from '../../shared/format';
import { displayPrice, priceLabel } from '../../shared/lot-view';
import { mapsUrl } from '../../shared/geo';
import { paintColor } from '../../shared/paint';
import { gaugePositions, valueVerdict } from '../../shared/market-value';
import { HumanizePipe, KmPipe, MoneyPipe, ProvincePipe } from '../../shared/pipes';
import { MyStatusBadgeComponent, TitleBadgeComponent } from '../../shared/ui/badges.component';
import { ConditionGradeComponent } from '../../shared/ui/condition-grade.component';
import { InViewDirective } from '../../shared/ui/in-view.directive';
import { LotStatusComponent } from '../../shared/ui/lot-status.component';
import { WatchButtonComponent } from '../../shared/ui/watch-button.component';
import { BidHistoryComponent } from './bid-history.component';
import { BidPanelComponent } from './bid-panel.component';
import { GalleryComponent } from './gallery.component';
import { IconComponent } from '../../shared/ui/icon.component';

type LoadState = 'loading' | 'ready' | 'not_found' | 'error';

@Component({
  selector: 'app-vehicle-detail-page',
  imports: [
    RouterLink,
    InViewDirective,
    GalleryComponent,
    BidPanelComponent,
    BidHistoryComponent,
    LotStatusComponent,
    ConditionGradeComponent,
    TitleBadgeComponent,
    MyStatusBadgeComponent,
    WatchButtonComponent,
    HumanizePipe,
    KmPipe,
    MoneyPipe,
    ProvincePipe,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehicle-detail.page.html',
  styleUrl: './vehicle-detail.page.scss',
})
export class VehicleDetailPage {
  /** Route param, bound via withComponentInputBinding(). */
  readonly id = input.required<string>();

  private readonly api = inject(AuctionApi);
  private readonly live = inject(LiveAuctionService);
  private readonly bidder = inject(BidderService);
  private readonly toasts = inject(ToastService);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly clock = inject(ClockService);

  protected readonly vehicle = signal<VehicleDetail | null>(null);
  protected readonly state = signal<LoadState>('loading');
  protected readonly priceFlash = signal(0);
  /** Mobile: show the sticky bid bar once the bid panel scrolls out of view. */
  protected readonly panelInView = signal(true);

  protected readonly name = computed(() => {
    const vehicle = this.vehicle();
    return vehicle ? vehicleName(vehicle) : '';
  });
  protected readonly listed = computed(() => {
    const vehicle = this.vehicle();
    if (!vehicle) return null;
    return { ago: formatAge(vehicle.listedAt, this.clock.now()), at: formatDateTime(vehicle.listedAt) };
  });
  protected readonly closesAt = computed(() => {
    const vehicle = this.vehicle();
    return vehicle ? formatDateTime(vehicle.auction.closesAt) : '';
  });
  protected readonly paint = computed(() => {
    const vehicle = this.vehicle();
    return vehicle ? paintColor(vehicle.exteriorColor) : null;
  });
  protected readonly mapUrl = computed(() => {
    const vehicle = this.vehicle();
    return vehicle ? mapsUrl(vehicle.city, vehicle.province) : null;
  });
  protected readonly distance = computed(() => {
    const vehicle = this.vehicle();
    return !vehicle || vehicle.distanceKm === null ? null : formatDistance(vehicle.distanceKm, vehicle.distanceBasis);
  });

  /** The estimate, and where today's price (and Buy Now) sit against it. */
  protected readonly value = computed(() => {
    const vehicle = this.vehicle();
    if (!vehicle) return null;
    const { auction, marketValue } = vehicle;
    const price = displayPrice(auction);
    const buyNow = auction.buyNowAvailable ? auction.buyNowPrice : null;
    return {
      estimate: marketValue,
      price,
      priceLabel: priceLabel(auction),
      buyNow,
      gauge: gaugePositions(marketValue, price, buyNow),
      verdict: valueVerdict(auction, marketValue),
    };
  });
  protected readonly today = computed(() => formatDay(this.clock.now()));

  /** "Bid now" in the list view links here with #bid: land on the bid box, ready to type. */
  private pendingBidFocus = this.route.snapshot.fragment === 'bid';

  /** Arrived from inside the app? Then "Back" returns to the exact filtered list. */
  private readonly cameFromApp = this.router.currentNavigation()?.previousNavigation != null;
  private readonly reload$ = new Subject<void>();
  private readonly bidPanel = viewChild(BidPanelComponent);
  private readonly bidPanelElement = viewChild('bidPanelAnchor', { read: ElementRef });

  constructor() {
    toObservable(this.id)
      .pipe(
        switchMap((id) =>
          this.reload$.pipe(
            startWith(undefined),
            switchMap(() =>
              this.api.vehicle(id).pipe(
                catchError((error: { status?: number }) => {
                  this.state.set(error.status === 404 ? 'not_found' : 'error');
                  return of(null);
                }),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((vehicle) => {
        if (!vehicle) return;
        this.vehicle.set(vehicle);
        this.state.set('ready');
        if (this.pendingBidFocus && vehicle.auction.status === 'open') {
          this.pendingBidFocus = false;
          afterNextRender(() => this.scrollToBid(), { injector: this.injector });
        }
      });

    this.live.updates$.pipe(takeUntilDestroyed()).subscribe((update) => this.applyLiveUpdate(update));

    effect(() => {
      const vehicle = this.vehicle();
      this.title.setTitle(vehicle ? `${vehicleName(vehicle)} · Lot ${vehicle.lot} · The Block` : 'Vehicle · The Block');
    });
  }

  protected back(): void {
    if (this.cameFromApp) this.location.back();
    else void this.router.navigate(['/']);
  }

  protected onBidPlaced(fresh: VehicleDetail): void {
    this.vehicle.set(fresh);
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected scrollToBid(): void {
    const element = this.bidPanelElement()?.nativeElement as HTMLElement | undefined;
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => this.bidPanel()?.focusBidInput(), 400);
  }

  protected async copyVin(vin: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(vin);
      this.toasts.show({ tone: 'info', title: 'VIN copied', message: vin }, 2500);
    } catch {
      this.toasts.show({ tone: 'info', title: 'VIN', message: vin }, 4000);
    }
  }

  private applyLiveUpdate(update: AuctionUpdate): void {
    const current = this.vehicle();
    if (!current || current.id !== update.vehicleId) return;

    const handle = this.bidder.handle();
    const next = applyAuctionUpdate(current, update, handle);
    this.vehicle.set({ ...next, recentBids: withLiveBid(current.recentBids, update, handle) });
    if (update.auction.currentBid !== current.auction.currentBid) {
      this.priceFlash.update((count) => count + 1);
    }
  }
}

/** Prepends the broadcast bid unless we already have it (e.g. from our own POST response). */
function withLiveBid(bids: Bid[], update: AuctionUpdate, myHandle: string | null): Bid[] {
  const last = update.lastBid;
  if (!last) return bids;
  const duplicate = bids.some((bid) => bid.amount === last.amount && bid.placedAt === last.placedAt);
  if (duplicate) return bids;
  const liveBid: Bid = {
    id: -Date.parse(last.placedAt), // client-side key; real ids arrive on the next fetch
    amount: last.amount,
    bidderHandle: last.bidderHandle,
    isYou: myHandle !== null && last.bidderHandle === myHandle,
    placedAt: last.placedAt,
    kind: last.kind,
  };
  return [liveBid, ...bids];
}

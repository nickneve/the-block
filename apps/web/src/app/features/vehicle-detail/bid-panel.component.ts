import { Dialog } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuctionApi, toApiError } from '../../core/api/auction-api';
import { VehicleDetail } from '../../core/api/models';
import { MyBidsStore } from '../../core/state/my-bids.store';
import { ToastService } from '../../core/toast.service';
import { formatDateTime, formatMoney, vehicleName } from '../../shared/format';
import { MoneyPipe } from '../../shared/pipes';
import { ReserveBadgeComponent } from '../../shared/ui/badges.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { LotStatusComponent } from '../../shared/ui/lot-status.component';
import { checkBid, parseAmount, quickBidAmounts } from './bid-options';
import { ConfirmBidData, ConfirmBidDialog } from './confirm-bid.dialog';

@Component({
  selector: 'app-bid-panel',
  imports: [
    MoneyPipe,
    LotStatusComponent,
    ReserveBadgeComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bid-panel.component.html',
  styleUrl: './bid-panel.component.scss',
})
export class BidPanelComponent {
  readonly vehicle = input.required<VehicleDetail>();
  /** Increments when a live update changes the price, to replay the highlight. */
  readonly priceFlash = input(0);
  /** Emits the server's fresh copy of the vehicle after a successful bid / Buy Now. */
  readonly updated = output<VehicleDetail>();
  /** Asks the page to refetch (e.g. we were outbid mid-confirmation). */
  readonly stale = output<void>();

  private readonly api = inject(AuctionApi);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(ToastService);
  private readonly myBids = inject(MyBidsStore);
  private readonly amountInput = viewChild<ElementRef<HTMLInputElement>>('amountInput');
  private readonly priceBlock = viewChild<ElementRef<HTMLElement>>('priceBlock');

  constructor() {
    // Briefly highlight the price whenever a live bid moves it.
    effect(() => {
      if (this.priceFlash() === 0) return;
      const element = this.priceBlock()?.nativeElement;
      if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const highlight = getComputedStyle(element).getPropertyValue('--success-soft').trim();
      element.animate([{ backgroundColor: highlight }, { backgroundColor: 'transparent' }], {
        duration: 1400,
        easing: 'ease-out',
      });
    });
  }

  protected readonly customText = signal('');
  protected readonly chosenQuick = signal<number | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverMessage = signal<{ tone: 'danger' | 'info'; text: string } | null>(null);

  protected readonly auction = computed(() => this.vehicle().auction);
  protected readonly isOpen = computed(() => this.auction().status === 'open');
  protected readonly isLeading = computed(() => this.vehicle().myStatus === 'winning');
  protected readonly quickBids = computed(() => quickBidAmounts(this.auction().minNextBid, this.auction().bidIncrement));
  protected readonly closesAtLabel = computed(() => formatDateTime(this.auction().closesAt));

  /** What "Place bid" will submit: typed amount, else a chosen quick bid (if still valid), else the minimum. */
  protected readonly amount = computed(() => {
    const typed = parseAmount(this.customText());
    if (typed !== null) return typed;
    const quick = this.chosenQuick();
    return quick !== null && quick >= this.auction().minNextBid ? quick : this.auction().minNextBid;
  });

  protected readonly amountError = computed(() =>
    this.customText() ? checkBid(this.amount(), this.auction(), formatMoney).error : null,
  );

  protected readonly canBid = computed(
    () => this.isOpen() && !this.isLeading() && !this.submitting() && this.amountError() === null,
  );

  protected readonly priceLabel = computed(() => {
    const { status, outcome, currentBid } = this.auction();
    if (status === 'ended') return outcome === 'sold' ? 'Sold for' : currentBid === null ? 'Starting bid' : 'Top bid';
    return currentBid === null ? 'Starting bid' : 'Current bid';
  });

  focusBidInput(): void {
    this.amountInput()?.nativeElement.focus();
  }

  protected chooseQuick(amount: number): void {
    this.customText.set('');
    this.chosenQuick.set(amount);
    this.serverMessage.set(null);
  }

  protected onAmountInput(event: Event): void {
    this.customText.set((event.target as HTMLInputElement).value);
    this.chosenQuick.set(null);
    this.serverMessage.set(null);
  }

  protected async placeBid(): Promise<void> {
    if (!this.canBid()) return;
    const amount = this.amount();
    if (!(await this.confirm('bid', amount))) return;

    this.submit(this.api.placeBid(this.vehicle().id, amount), () => {
      this.toasts.show({ tone: 'success', title: "You're the high bidder", message: `${formatMoney(amount)} on ${vehicleName(this.vehicle())}` });
    });
  }

  protected async buyNow(): Promise<void> {
    const price = this.auction().buyNowPrice;
    if (price === null || !this.auction().buyNowAvailable || this.submitting()) return;
    if (!(await this.confirm('buy_now', price))) return;

    this.submit(this.api.buyNow(this.vehicle().id), () => {
      this.toasts.show({ tone: 'success', title: 'Purchased!', message: `${vehicleName(this.vehicle())} is yours for ${formatMoney(price)}.` }, 9000);
    });
  }

  private async confirm(kind: ConfirmBidData['kind'], amount: number): Promise<boolean> {
    const vehicle = this.vehicle();
    const ref = this.dialog.open<boolean, ConfirmBidData>(ConfirmBidDialog, {
      data: {
        kind,
        amount,
        vehicleName: `${vehicleName(vehicle)} ${vehicle.trim}`,
        lot: vehicle.lot,
        minNextBid: vehicle.auction.minNextBid,
        buyNowPrice: vehicle.auction.buyNowAvailable ? vehicle.auction.buyNowPrice : null,
        titleStatus: vehicle.titleStatus,
      },
      ariaLabelledBy: 'confirm-bid-title',
      backdropClass: 'cdk-overlay-dark-backdrop',
    });
    return (await firstValueFrom(ref.closed)) === true;
  }

  private submit(request: ReturnType<AuctionApi['placeBid']>, onSuccess: () => void): void {
    this.submitting.set(true);
    this.serverMessage.set(null);

    request.subscribe({
      next: (fresh) => {
        this.submitting.set(false);
        this.customText.set('');
        this.chosenQuick.set(null);
        this.updated.emit(fresh);
        this.myBids.record(fresh);
        onSuccess();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const apiError = toApiError(error);
        switch (apiError.code) {
          case 'BID_TOO_LOW':
            this.serverMessage.set({
              tone: 'danger',
              text: `Another buyer bid first. The minimum is now ${formatMoney(apiError.details?.minNextBid ?? this.auction().minNextBid)}.`,
            });
            this.customText.set('');
            this.stale.emit();
            break;
          case 'AUCTION_CLOSED':
          case 'BUY_NOW_UNAVAILABLE':
          case 'ALREADY_HIGH_BIDDER':
            // The lot changed under us — explain, then refresh to the real state.
            this.serverMessage.set({ tone: 'info', text: apiError.message });
            this.stale.emit();
            break;
          default:
            this.serverMessage.set({ tone: 'danger', text: apiError.message });
        }
      },
    });
  }
}

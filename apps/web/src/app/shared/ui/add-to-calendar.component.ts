import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { auctionCloseEvent, googleCalendarUrl, icsFile, outlookUrl } from '../calendar';
import { IconComponent } from './icon.component';

const BELOW_END: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
];

/**
 * Puts an auction's close in the buyer's calendar: Google and Outlook open a
 * pre-filled event; Apple Calendar and desktop Outlook get an .ics file.
 */
@Component({
  selector: 'app-add-to-calendar',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="variant() === 'icon' ? 'icon-btn icon-btn--sm' : 'link-btn calendar-link'"
      [cdkMenuTriggerFor]="calendarMenu"
      [cdkMenuPosition]="positions"
      [attr.aria-label]="variant() === 'icon' ? 'Add the close to your calendar' : null"
      [attr.title]="variant() === 'icon' ? 'Add to calendar' : null"
    >
      <svg appIcon="calendar-plus" [size]="variant() === 'icon' ? 16 : 15"></svg>
      @if (variant() === 'link') {
        Add to calendar
      }
    </button>

    <ng-template #calendarMenu>
      <div class="menu" cdkMenu aria-label="Add to calendar">
        <p class="menu-label">Starts {{ leadMinutes }} min before the close</p>
        <a cdkMenuItem class="menu-item" [href]="google()" target="_blank" rel="noopener">Google Calendar</a>
        <a cdkMenuItem class="menu-item" [href]="outlook()" target="_blank" rel="noopener">Outlook.com</a>
        <a cdkMenuItem class="menu-item" [href]="office()" target="_blank" rel="noopener">Outlook (Microsoft 365)</a>
        <button type="button" cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="downloadIcs()">
          Apple Calendar or Outlook app
          <span class="menu-meta">.ics</span>
        </button>
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .calendar-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 13.5px;
      font-weight: 600;
    }
  `,
})
export class AddToCalendarComponent {
  /** "2019 Chevrolet Equinox LS" */
  readonly name = input.required<string>();
  readonly lot = input.required<string>();
  readonly closesAt = input.required<string>();
  /** Seller and city, shown as the event's location. */
  readonly location = input.required<string>();
  /** Link back to the lot (defaults to this page). */
  readonly url = input<string | null>(null);
  readonly variant = input<'icon' | 'link'>('link');

  protected readonly positions = BELOW_END;
  protected readonly leadMinutes = 15;

  private readonly event = computed(() =>
    auctionCloseEvent({
      name: this.name(),
      lot: this.lot(),
      closesAt: this.closesAt(),
      location: this.location(),
      url: this.url() ?? (typeof location === 'undefined' ? '' : location.href.split('#')[0]),
    }),
  );
  protected readonly google = computed(() => googleCalendarUrl(this.event()));
  protected readonly outlook = computed(() => outlookUrl(this.event(), 'live'));
  protected readonly office = computed(() => outlookUrl(this.event(), 'office'));
  /** Built in the browser, so the download needs no server round trip. */
  protected downloadIcs(): void {
    const url = URL.createObjectURL(new Blob([icsFile(this.event())], { type: 'text/calendar;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `the-block-lot-${this.lot()}.ics` });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { ToastService } from '../../core/toast.service';
import { photoTint, tintedPhoto } from '../../shared/placeholder-photo';
import { IconComponent } from '../../shared/ui/icon.component';
import { VehicleImageComponent } from '../../shared/ui/vehicle-image.component';
import { WatchButtonComponent } from '../../shared/ui/watch-button.component';
import { PhotoViewerData, PhotoViewerDialog } from './photo-viewer.dialog';

/**
 * One scroll-snap track serves both platforms: swipe on touch, arrows and
 * thumbnails on desktop, arrow keys when focused. Click a photo (or the
 * counter) for full screen. The watch star and engine sound sit on the photo.
 */
@Component({
  selector: 'app-gallery',
  imports: [VehicleImageComponent, IconComponent, WatchButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage">
      <div
        #track
        class="track"
        tabindex="0"
        role="region"
        aria-roledescription="carousel"
        [attr.aria-label]="alt() + ' photos'"
        (scroll)="onScroll()"
        (keydown.arrowleft)="go(index() - 1)"
        (keydown.arrowright)="go(index() + 1)"
        (keydown.enter)="openViewer()"
      >
        @for (src of images(); track $index) {
          <!-- Clicking opens full screen; the counter button below does the same for keyboards. -->
          <div class="slide" [attr.aria-label]="'Photo ' + ($index + 1) + ' of ' + images().length" (click)="openViewer($index)">
            <app-vehicle-image
              [src]="src"
              [alt]="alt() + ', photo ' + ($index + 1)"
              [paint]="paint()"
              [eager]="$index === 0"
            />
          </div>
        }
      </div>

      @if (images().length > 1) {
        <button type="button" class="nav prev" aria-label="Previous photo" [disabled]="index() === 0" (click)="go(index() - 1)">
          <svg appIcon="chevron-left" [size]="22"></svg>
        </button>
        <button
          type="button"
          class="nav next"
          aria-label="Next photo"
          [disabled]="index() === images().length - 1"
          (click)="go(index() + 1)"
        >
          <svg appIcon="chevron-right" [size]="22"></svg>
        </button>
      }

      <app-watch-button class="watch" [vehicleId]="vehicleId()" variant="overlay" />

      <button type="button" class="overlay-btn engine" (click)="playEngine()">
        <svg appIcon="volume-2" [size]="15" [strokeWidth]="2.2"></svg>
        Engine sound
      </button>

      <button type="button" class="overlay-btn counter tabular" [attr.aria-label]="'View ' + images().length + ' photos full screen'" (click)="openViewer()">
        <svg appIcon="maximize-2" [size]="14" [strokeWidth]="2.4"></svg>
        {{ index() + 1 }} / {{ images().length }}
      </button>
    </div>

    @if (images().length > 1) {
      <div class="thumbs">
        @for (src of images(); track $index) {
          <button
            type="button"
            class="thumb"
            [class.active]="$index === index()"
            [attr.aria-current]="$index === index()"
            [attr.aria-label]="'Show photo ' + ($index + 1)"
            (click)="go($index)"
          >
            <img [src]="thumbnail(src)" alt="" loading="lazy" />
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .stage {
      position: relative;
      overflow: hidden;
      border-radius: var(--radius-lg);
      background: var(--surface-muted);
    }
    .track {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      scrollbar-width: none;
    }
    .track::-webkit-scrollbar {
      display: none;
    }
    .track:focus-visible {
      outline-offset: -3px;
    }
    .slide {
      flex: 0 0 100%;
      scroll-snap-align: start;
      cursor: zoom-in;
    }
    /* Glass buttons on the photo, matching the overlay chips. */
    .overlay-btn {
      position: absolute;
      bottom: var(--space-3);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border: 0;
      border-radius: var(--radius-pill);
      background: var(--overlay-chip);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      backdrop-filter: blur(6px);
      transition: background-color 0.15s var(--ease);
    }
    .overlay-btn:hover {
      background: rgb(14 23 38 / 0.92);
    }
    .engine {
      left: var(--space-3);
    }
    .watch {
      position: absolute;
      top: var(--space-3);
      right: var(--space-3);
    }
    .nav {
      position: absolute;
      top: 50%;
      display: none;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 50%;
      background: var(--overlay-chip);
      color: #fff;
      transform: translateY(-50%);
      backdrop-filter: blur(6px);
      transition: opacity 0.15s var(--ease);
    }
    .nav:disabled {
      opacity: 0;
      pointer-events: none;
    }
    .prev {
      left: var(--space-3);
    }
    .next {
      right: var(--space-3);
    }
    .counter {
      right: var(--space-3);
    }
    .thumbs {
      display: none;
      gap: var(--space-2);
      margin-top: var(--space-3);
      overflow-x: auto;
    }
    /* Shrink to fit so every photo's thumbnail shows, up to 88px each. */
    .thumb {
      flex: 1 1 0;
      min-width: 56px;
      max-width: 88px;
      aspect-ratio: 4 / 3;
      padding: 0;
      overflow: hidden;
      border: 2px solid transparent;
      border-radius: var(--radius-sm);
      background: var(--surface-muted);
      opacity: 0.7;
      transition: opacity 0.15s var(--ease), border-color 0.15s var(--ease);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb:hover {
      opacity: 1;
    }
    .thumb.active {
      border-color: var(--primary);
      opacity: 1;
    }
    @media (hover: hover) and (min-width: 768px) {
      .nav {
        display: grid;
      }
      .thumbs {
        display: flex;
      }
    }
  `,
})
export class GalleryComponent {
  readonly images = input.required<string[]>();
  readonly alt = input.required<string>();
  /** Exterior colour name, to tint placeholder photos. */
  readonly paint = input<string | null>(null);
  readonly vehicleId = input.required<string>();

  protected readonly index = signal(0);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly theme = inject(ThemeService);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(ToastService);

  private readonly tint = computed(() => photoTint(this.theme.theme(), this.paint()));

  protected thumbnail(src: string): string {
    return tintedPhoto(src, this.tint());
  }

  protected go(target: number): void {
    const index = Math.max(0, Math.min(this.images().length - 1, target));
    const track = this.track().nativeElement;
    track.scrollTo({ left: index * track.clientWidth });
    this.index.set(index);
  }

  /** Full screen on the chosen photo; the gallery follows to wherever the buyer stopped. */
  protected openViewer(at = this.index()): void {
    const data: PhotoViewerData = { images: this.images(), index: at, title: this.alt(), paint: this.paint() };
    this.dialog
      .open<number, PhotoViewerData>(PhotoViewerDialog, {
        data,
        width: '100vw',
        height: '100dvh',
        maxWidth: '100vw',
        maxHeight: '100dvh',
        backdropClass: 'photo-viewer-backdrop',
        ariaLabelledBy: 'photo-viewer-title',
        disableClose: true,
      })
      .closed.subscribe((last) => {
        if (last !== undefined) this.go(last);
      });
  }

  /** A walkaround's engine recording would play here; the sample data has none. */
  protected playEngine(): void {
    this.toasts.show(
      {
        tone: 'info',
        title: 'Engine sound',
        message: "On a live listing this plays the seller's recording of a cold start and idle. The sample data has no recordings.",
      },
      6000,
    );
  }

  protected onScroll(): void {
    const track = this.track().nativeElement;
    this.index.set(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
  }
}

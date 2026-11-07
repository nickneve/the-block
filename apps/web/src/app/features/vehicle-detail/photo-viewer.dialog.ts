import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { photoTint, resizedPhoto, tintedPhoto } from '../../shared/placeholder-photo';
import { IconComponent } from '../../shared/ui/icon.component';

export interface PhotoViewerData {
  images: string[];
  /** The photo to open on. */
  index: number;
  /** "2019 Chevrolet Equinox LS" */
  title: string;
  paint: string | null;
}

/**
 * Full-screen photos: the whole frame (no cropping), arrows and arrow keys on
 * desktop, swipe on touch, Esc to close. Resolves to the photo it closed on,
 * so the page's gallery can follow.
 */
@Component({
  selector: 'app-photo-viewer',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.arrowleft)': 'go(index() - 1)',
    '(keydown.arrowright)': 'go(index() + 1)',
    // Handled here (the dialog opens with disableClose) so Esc also reports where the buyer was.
    '(keydown.escape)': 'close()',
  },
  template: `
    <header class="top">
      <h2 class="title" id="photo-viewer-title">{{ data.title }}</h2>
      <span class="count tabular" aria-live="polite">{{ index() + 1 }} / {{ data.images.length }}</span>
      <button type="button" class="close" aria-label="Close photos" (click)="close()">
        <svg appIcon="x" [size]="22"></svg>
      </button>
    </header>

    <div class="stage">
      <div #track class="track" (scroll)="onScroll()">
        @for (src of data.images; track $index) {
          <div class="slide">
            <img [src]="large(src)" [alt]="data.title + ', photo ' + ($index + 1)" [attr.loading]="near($index) ? 'eager' : 'lazy'" />
          </div>
        }
      </div>

      @if (data.images.length > 1) {
        <button type="button" class="nav prev" aria-label="Previous photo" [disabled]="index() === 0" (click)="go(index() - 1)">
          <svg appIcon="chevron-left" [size]="28"></svg>
        </button>
        <button
          type="button"
          class="nav next"
          aria-label="Next photo"
          [disabled]="index() === data.images.length - 1"
          (click)="go(index() + 1)"
        >
          <svg appIcon="chevron-right" [size]="28"></svg>
        </button>
      }
    </div>

    @if (data.images.length > 1) {
      <div class="thumbs">
        @for (src of data.images; track $index) {
          <button
            type="button"
            class="thumb"
            [class.active]="$index === index()"
            [attr.aria-current]="$index === index()"
            [attr.aria-label]="'Show photo ' + ($index + 1)"
            (click)="go($index)"
          >
            <img [src]="small(src)" alt="" loading="lazy" />
          </button>
        }
      </div>
    }
  `,
  styles: `
    /* Its own near-black stage, so the page never shows through behind the photo. */
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: #05080f;
      color: #fff;
    }
    .top {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-5);
    }
    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      font-size: 16px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .count {
      color: rgb(255 255 255 / 0.75);
      font-size: 14px;
      font-weight: 600;
    }
    .close {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 50%;
      background: rgb(255 255 255 / 0.08);
      color: #fff;
    }
    .close:hover {
      background: rgb(255 255 255 / 0.16);
    }
    .stage {
      position: relative;
      flex: 1;
      min-height: 0;
    }
    .track {
      display: flex;
      height: 100%;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
    }
    .track::-webkit-scrollbar {
      display: none;
    }
    .slide {
      display: grid;
      flex: 0 0 100%;
      place-items: center;
      padding: 0 var(--space-3);
      scroll-snap-align: start;
    }
    /* The whole photo, as large as the screen allows: nothing cropped. */
    .slide img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: var(--radius-md);
    }
    .nav {
      position: absolute;
      top: 50%;
      display: none;
      place-items: center;
      width: 52px;
      height: 52px;
      border: 0;
      border-radius: 50%;
      background: rgb(255 255 255 / 0.1);
      color: #fff;
      transform: translateY(-50%);
    }
    .nav:hover {
      background: rgb(255 255 255 / 0.2);
    }
    .nav:disabled {
      opacity: 0;
      pointer-events: none;
    }
    .prev {
      left: var(--space-4);
    }
    .next {
      right: var(--space-4);
    }
    .thumbs {
      display: flex;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4) var(--space-4);
      overflow-x: auto;
    }
    .thumb {
      flex: 0 0 72px;
      aspect-ratio: 4 / 3;
      padding: 0;
      overflow: hidden;
      border: 2px solid transparent;
      border-radius: var(--radius-sm);
      background: rgb(255 255 255 / 0.06);
      opacity: 0.55;
      transition: opacity 0.15s var(--ease), border-color 0.15s var(--ease);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb:hover {
      opacity: 0.9;
    }
    .thumb.active {
      border-color: #fff;
      opacity: 1;
    }
    @media (hover: hover) and (min-width: 768px) {
      .nav {
        display: grid;
      }
      .slide {
        padding: 0 88px;
      }
    }
  `,
})
export class PhotoViewerDialog {
  protected readonly data = inject<PhotoViewerData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<number>>(DialogRef);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly theme = inject(ThemeService);

  protected readonly index = signal(this.data.index);
  private readonly tint = computed(() => photoTint(this.theme.theme(), this.data.paint));

  constructor() {
    // Open on the photo the buyer clicked, without animating through the others.
    afterNextRender(() => {
      const track = this.track().nativeElement;
      track.scrollTo({ left: this.data.index * track.clientWidth, behavior: 'instant' });
    });
  }

  protected large(src: string): string {
    return tintedPhoto(resizedPhoto(src, 1600, 1200), this.tint());
  }

  protected small(src: string): string {
    return tintedPhoto(src, this.tint());
  }

  /** Load the open photo and its neighbours first. */
  protected near(i: number): boolean {
    return Math.abs(i - this.data.index) <= 1;
  }

  protected go(target: number): void {
    const index = Math.max(0, Math.min(this.data.images.length - 1, target));
    const track = this.track().nativeElement;
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    this.index.set(index);
  }

  protected onScroll(): void {
    const track = this.track().nativeElement;
    this.index.set(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
  }

  protected close(): void {
    this.dialogRef.close(this.index());
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { photoTint, tintedPhoto } from '../placeholder-photo';
import { IconComponent } from './icon.component';

/**
 * Photo with a reserved 4:3 box (no layout shift), a shimmer while loading,
 * and a calm fallback if the image host is unreachable. Placeholder photos are
 * tinted with the car's paint colour, and the box shows it while loading too.
 */
@Component({
  selector: 'app-vehicle-image',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.background-color]': 'tint().background' },
  template: `
    @if (!failed()) {
      <img
        [src]="displaySrc()"
        [alt]="alt()"
        [attr.loading]="eager() ? 'eager' : 'lazy'"
        decoding="async"
        [class.loaded]="loaded()"
        (load)="loaded.set(true)"
        (error)="failed.set(true)"
      />
    }
    @if (!loaded() && !failed()) {
      <span class="skeleton placeholder" aria-hidden="true"></span>
    }
    @if (failed()) {
      <span class="fallback" role="img" [attr.aria-label]="alt() + ' (photo unavailable)'" [style.color]="tint().text">
        <svg appIcon="car-front" [size]="40" [strokeWidth]="1.4"></svg>
        <span>Photo unavailable</span>
      </span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      aspect-ratio: 4 / 3;
      overflow: hidden;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 0.25s var(--ease);
    }
    img.loaded {
      opacity: 1;
    }
    /* A soft sheen over the paint colour, rather than a grey block. */
    .skeleton.placeholder {
      position: absolute;
      inset: 0;
      border-radius: 0;
      background: linear-gradient(90deg, transparent 25%, rgb(255 255 255 / 0.16) 37%, transparent 63%);
      background-size: 400% 100%;
    }
    .fallback {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
    }
  `,
})
export class VehicleImageComponent {
  readonly src = input.required<string>();
  readonly alt = input.required<string>();
  readonly eager = input(false);
  /** The exterior colour name, e.g. "Rapid Red"; unknown or missing stays neutral. */
  readonly paint = input<string | null>(null);

  private readonly theme = inject(ThemeService);
  protected readonly tint = computed(() => photoTint(this.theme.theme(), this.paint()));
  protected readonly displaySrc = computed(() => tintedPhoto(this.src(), this.tint()));
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
}

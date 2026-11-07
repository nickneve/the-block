import { Theme } from '../core/theme.service';
import { contrast, mixHex, paintColor } from './paint';

const PLACEHOLDER = /(placehold\.co\/\d+x\d+)\/[0-9a-f]{3,8}\/[0-9a-f]{3,8}/i;

/** Background and text colours (#rrggbb) for a placeholder photo. */
export interface PhotoTint {
  background: string;
  text: string;
}

/** Quiet greys that sit on each theme's surfaces when a lot's colour is unknown. */
const NEUTRAL: Record<Theme, PhotoTint> = {
  light: { background: '#dfe5ee', text: '#66728a' },
  dark: { background: '#222d4a', text: '#9aa6bd' },
};

/** How much of the paint shows through the neutral: enough to recognise, never loud. */
const PAINT_STRENGTH: Record<Theme, number> = { light: 0.7, dark: 0.6 };

/**
 * The dataset's "photos" are identical grey placeholders, so every card looked
 * the same. Tinting each one with the car's exterior colour hints at what a
 * real photo would show and makes the grid easier to scan.
 */
export function photoTint(theme: Theme, exteriorColor?: string | null): PhotoTint {
  const neutral = NEUTRAL[theme];
  const paint = exteriorColor ? paintColor(exteriorColor) : null;
  if (!paint) return neutral;

  const background = mixHex(neutral.background, paint, PAINT_STRENGTH[theme]);
  // The caption is the same hue, pushed darker or lighter — whichever reads better.
  const darker = mixHex(background, '#000000', 0.6);
  const lighter = mixHex(background, '#ffffff', 0.75);
  return { background, text: contrast(background, darker) >= contrast(background, lighter) ? darker : lighter };
}

/** Applies a tint to a placehold.co URL. Real photo URLs pass through untouched. */
export function tintedPhoto(src: string, tint: PhotoTint): string {
  return src.replace(PLACEHOLDER, `$1/${tint.background.slice(1)}/${tint.text.slice(1)}`);
}

const PLACEHOLDER_SIZE = /(placehold\.co\/)\d+x\d+/i;

/** A larger render of a placeholder (sharp when shown full screen). Real photo URLs pass through untouched. */
export function resizedPhoto(src: string, width: number, height: number): string {
  return src.replace(PLACEHOLDER_SIZE, `$1${width}x${height}`);
}

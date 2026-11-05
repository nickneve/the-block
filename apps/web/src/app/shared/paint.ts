/**
 * Approximate paint colours for exterior colour names. Matched by keyword, so
 * "Rapid Red" and "Red" both read as red and a new name still lands somewhere
 * sensible. Order matters: "Dark Blue" must hit navy before plain blue.
 */
const PAINTS: readonly [pattern: RegExp, hex: string][] = [
  [/midnight|dark blue|navy/i, '#1e2d52'],
  [/dark green|forest/i, '#24452f'],
  [/burgundy|maroon|wine/i, '#6e1f2b'],
  [/champagne|beige|tan/i, '#cdb894'],
  [/bronze|copper/i, '#8c5a31'],
  [/orange/i, '#d9661f'],
  [/red/i, '#b3241f'],
  [/blue/i, '#2f5fae'],
  [/green/i, '#3f7a4a'],
  [/yellow|gold/i, '#d6a926'],
  [/pearl/i, '#ece7dc'],
  [/white/i, '#f3f4f5'],
  [/silver/i, '#b8bdc4'],
  [/grey|gray|graphite/i, '#6b7078'],
  [/black/i, '#16181c'],
];

/** The paint colour for an exterior colour name, or null when it isn't recognised. */
export function paintColor(name: string): string | null {
  return PAINTS.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

/** Linear blend of two #rrggbb colours: 0 → a, 1 → b. */
export function mixHex(a: string, b: string, amountOfB: number): string {
  const from = toRgb(a);
  const to = toRgb(b);
  return `#${from
    .map((channel, i) => Math.round(channel + (to[i] - channel) * amountOfB))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function toRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

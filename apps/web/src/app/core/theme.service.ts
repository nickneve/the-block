import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
/** What the buyer chose: a fixed theme, or follow the operating system. */
export type ThemePreference = Theme | 'system';

export const THEME_STORAGE_KEY = 'the-block.theme';

/**
 * Light/dark mode. The inline script in index.html applies the saved choice (or the
 * system setting) before boot, so there's no flash; this service takes over from there.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  /** The OS setting. Without matchMedia, trust what the boot script resolved. */
  private readonly systemDark = signal(
    this.media ? this.media.matches : this.document.documentElement.getAttribute('data-theme') === 'dark',
  );

  readonly preference = signal<ThemePreference>(readPreference());
  readonly theme = computed<Theme>(() => {
    const preference = this.preference();
    if (preference !== 'system') return preference;
    return this.systemDark() ? 'dark' : 'light';
  });

  constructor() {
    this.media?.addEventListener?.('change', (event) => this.systemDark.set(event.matches));

    effect(() => this.document.documentElement.setAttribute('data-theme', this.theme()));
    effect(() => {
      const preference = this.preference();
      try {
        localStorage.setItem(THEME_STORAGE_KEY, preference);
      } catch {
        // Storage unavailable — the choice just won't persist.
      }
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
  }

  toggle(): void {
    this.preference.set(this.theme() === 'dark' ? 'light' : 'dark');
  }
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

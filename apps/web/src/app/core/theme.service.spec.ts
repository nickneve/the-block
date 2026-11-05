import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute('data-theme', 'light');
    delete (document.defaultView as { matchMedia?: unknown }).matchMedia;
    TestBed.resetTestingModule();
  });

  it('follows the theme the boot script applied when nothing was chosen', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
    expect(service.theme()).toBe('dark');
  });

  it('toggles, updates <html data-theme> and remembers the choice', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('tracks the operating system while set to System', () => {
    let listener: ((event: { matches: boolean }) => void) | undefined;
    Object.assign(document.defaultView!, {
      matchMedia: () => ({
        matches: false,
        addEventListener: (_: string, callback: typeof listener) => (listener = callback),
      }),
    });
    localStorage.setItem(THEME_STORAGE_KEY, 'system');

    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('light');

    listener?.({ matches: true });
    TestBed.tick();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // A fixed choice stops following the OS.
    service.setPreference('light');
    listener?.({ matches: true });
    TestBed.tick();
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});

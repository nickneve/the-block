import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

/**
 * Emits whether the host element is on screen — drives the mobile sticky bid
 * bar and infinite scroll. `inViewMargin` grows or shrinks the viewport, e.g.
 * "0px 0px 800px 0px" fires before the element actually scrolls into view.
 */
@Directive({ selector: '[appInView]' })
export class InViewDirective {
  readonly appInView = output<boolean>();
  readonly inViewMargin = input('0px 0px -80px 0px');

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(([entry]) => this.appInView.emit(entry.isIntersecting), {
        rootMargin: this.inViewMargin(),
      });
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

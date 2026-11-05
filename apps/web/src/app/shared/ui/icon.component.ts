import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconName, ICONS } from './icons';

/**
 * Inline SVG icon: `<svg appIcon="gavel" [size]="18"></svg>`.
 * Decorative by default (aria-hidden); label the surrounding button or link instead.
 */
@Component({
  selector: 'svg[appIcon]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    '[attr.width]': 'size()',
    '[attr.height]': 'size()',
    '[attr.stroke-width]': 'strokeWidth()',
  },
  template: `
    @for (node of nodes(); track $index) {
      @let a = node[1];
      @switch (node[0]) {
        @case ('path') {
          <svg:path [attr.d]="a['d']" />
        }
        @case ('circle') {
          <svg:circle [attr.cx]="a['cx']" [attr.cy]="a['cy']" [attr.r]="a['r']" />
        }
        @case ('rect') {
          <svg:rect
            [attr.x]="a['x']"
            [attr.y]="a['y']"
            [attr.width]="a['width']"
            [attr.height]="a['height']"
            [attr.rx]="a['rx']"
            [attr.ry]="a['ry']"
          />
        }
        @case ('line') {
          <svg:line [attr.x1]="a['x1']" [attr.y1]="a['y1']" [attr.x2]="a['x2']" [attr.y2]="a['y2']" />
        }
        @case ('polyline') {
          <svg:polyline [attr.points]="a['points']" />
        }
        @case ('polygon') {
          <svg:polygon [attr.points]="a['points']" />
        }
        @case ('ellipse') {
          <svg:ellipse [attr.cx]="a['cx']" [attr.cy]="a['cy']" [attr.rx]="a['rx']" [attr.ry]="a['ry']" />
        }
      }
    }
  `,
})
export class IconComponent {
  readonly appIcon = input.required<IconName>();
  readonly size = input<number>(24);
  readonly strokeWidth = input<number>(2);

  protected readonly nodes = computed(() => ICONS[this.appIcon()] as readonly (readonly [string, Record<string, string | number>])[]);
}

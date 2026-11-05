import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { gradeBand } from '../format';

/** Condition grade (1.0–5.0) as a number, a word, and a five-segment meter. */
@Component({
  selector: 'app-condition-grade',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="grade" [class.grade--lg]="size() === 'lg'" [attr.data-tone]="band().tone">
      <span class="score tabular">{{ grade() | number: '1.1-1' }}</span>
      <span class="meter" aria-hidden="true">
        @for (segment of segments; track segment) {
          <span class="segment" [style.--fill]="fill(segment)"></span>
        }
      </span>
      <span class="label">{{ band().label }}</span>
      <span class="sr-only">condition grade out of 5</span>
    </span>
  `,
  styles: `
    .grade {
      --tone: var(--success);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }
    .grade[data-tone='warning'] {
      --tone: var(--warning);
    }
    .grade[data-tone='danger'] {
      --tone: var(--danger);
    }
    .grade[data-tone='primary'] {
      --tone: var(--primary);
    }
    .score {
      color: var(--text);
    }
    .label {
      color: var(--tone);
    }
    .meter {
      display: inline-flex;
      gap: 2px;
    }
    .segment {
      position: relative;
      width: 10px;
      height: 6px;
      border-radius: 2px;
      background: var(--surface-sunken);
      overflow: hidden;
    }
    .segment::after {
      content: '';
      position: absolute;
      inset: 0;
      width: calc(var(--fill) * 100%);
      background: var(--tone);
    }
    .grade--lg {
      gap: 12px;
      font-size: 15px;
    }
    .grade--lg .score {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .grade--lg .segment {
      width: 22px;
      height: 8px;
    }
  `,
})
export class ConditionGradeComponent {
  readonly grade = input.required<number>();
  readonly size = input<'sm' | 'lg'>('sm');

  protected readonly segments = [1, 2, 3, 4, 5];
  protected readonly band = computed(() => gradeBand(this.grade()));

  /** How full segment n (1–5) is, e.g. grade 3.4 → [1, 1, 1, 0.4, 0]. */
  protected fill(segment: number): number {
    return Math.max(0, Math.min(1, this.grade() - (segment - 1)));
  }
}

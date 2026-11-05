import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IconComponent } from '../../shared/ui/icon.component';

export interface SaveSearchData {
  suggestedName: string;
  /** Renaming an existing saved search rather than saving a new one. */
  rename?: boolean;
  /** Plain-language criteria, e.g. ["Ford", "Truck", "Under $30,000"]. */
  summary: string[];
}

/** Names a search before saving it. Resolves to the chosen name, or undefined if cancelled. */
@Component({
  selector: 'app-save-search-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-dialog' },
  template: `
    <form (submit)="save($event)">
      <header class="head">
        <h2>{{ data.rename ? 'Rename saved search' : 'Save this search' }}</h2>
        <button type="button" class="icon-btn" aria-label="Cancel" (click)="close()">
          <svg appIcon="x" [size]="20"></svg>
        </button>
      </header>

      <div class="content">
        <ul class="criteria" aria-label="Search criteria">
          @for (part of data.summary; track part) {
            <li class="chip">{{ part }}</li>
          }
        </ul>

        <label class="field">
          <span class="label">Name</span>
          <input
            class="input"
            type="text"
            maxlength="60"
            required
            cdkFocusInitial
            [value]="name()"
            (input)="name.set($any($event.target).value)"
          />
        </label>
        @if (!data.rename) {
          <p class="hint">Find it any time under Saved searches in your account menu, with a count of new matches.</p>
        }
      </div>

      <footer class="foot">
        <button type="button" class="btn btn--secondary" (click)="close()">Cancel</button>
        <button type="submit" class="btn btn--primary" [disabled]="!name().trim()">
          @if (data.rename) {
            Save name
          } @else {
            <svg appIcon="bookmark-plus" [size]="17"></svg>
            Save search
          }
        </button>
      </footer>
    </form>
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-4) 0 var(--space-5);
    }
    h2 {
      font-size: 20px;
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5) var(--space-5);
    }
    .criteria {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .label {
      font-size: 14px;
      font-weight: 600;
    }
    .hint {
      color: var(--text-muted);
      font-size: 13.5px;
    }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-top: 1px solid var(--border);
    }
  `,
})
export class SaveSearchDialog {
  protected readonly data = inject<SaveSearchData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<string>>(DialogRef);

  protected readonly name = signal(this.data.suggestedName);

  protected save(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    if (name) this.dialogRef.close(name);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}

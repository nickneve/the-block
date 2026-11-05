import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { toApiError } from '../../core/api/auction-api';
import { SavedSearch } from '../../core/api/models';
import { ClockService } from '../../core/clock.service';
import { SAVED_SEARCH_LIMIT, SavedSearchesStore } from '../../core/state/saved-searches.store';
import { ToastService } from '../../core/toast.service';
import { formatRelative } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { describeQuery, parseInventoryQuery } from '../inventory/inventory-query';
import { SaveSearchData, SaveSearchDialog } from './save-search.dialog';

/** The buyer's saved searches: open one, rename it or delete it. */
@Component({
  selector: 'app-saved-searches-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './saved-searches.page.html',
  styleUrl: './saved-searches.page.scss',
})
export class SavedSearchesPage {
  protected readonly saved = inject(SavedSearchesStore);
  private readonly clock = inject(ClockService);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(ToastService);

  protected readonly limit = SAVED_SEARCH_LIMIT;
  protected readonly rows = computed(() =>
    this.saved.items().map((search) => ({
      search,
      criteria: describeQuery(parseInventoryQuery(search.query)),
      savedAgo: formatRelative(search.createdAt, this.clock.now()),
    })),
  );

  constructor() {
    // Match counts move as lots are listed and close; refresh on every visit.
    this.saved.refresh();
  }

  protected rename(row: { search: SavedSearch; criteria: string[] }): void {
    const ref = this.dialog.open<string, SaveSearchData>(SaveSearchDialog, {
      data: { suggestedName: row.search.name, summary: row.criteria, rename: true },
    });
    ref.closed.pipe(filter((name): name is string => !!name && name !== row.search.name)).subscribe((name) => {
      this.saved.rename(row.search, name).subscribe({
        error: (error: unknown) =>
          this.toasts.show({ tone: 'danger', title: "Couldn't rename that search", message: toApiError(error).message }),
      });
    });
  }

  protected remove(search: SavedSearch): void {
    this.saved.remove(search);
    this.toasts.show({ tone: 'info', title: 'Saved search deleted', message: search.name }, 3500);
  }
}

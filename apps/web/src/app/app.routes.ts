import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Browse auctions · The Block',
    loadComponent: () => import('./features/inventory/inventory.page').then((m) => m.InventoryPage),
  },
  {
    path: 'vehicles/:id',
    loadComponent: () => import('./features/vehicle-detail/vehicle-detail.page').then((m) => m.VehicleDetailPage),
  },
  {
    path: 'my-bids',
    title: 'My bids · The Block',
    loadComponent: () => import('./features/my-bids/my-bids.page').then((m) => m.MyBidsPage),
  },
  {
    path: 'saved-searches',
    title: 'Saved searches · The Block',
    loadComponent: () => import('./features/saved-searches/saved-searches.page').then((m) => m.SavedSearchesPage),
  },
  {
    path: '**',
    title: 'Not found · The Block',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];

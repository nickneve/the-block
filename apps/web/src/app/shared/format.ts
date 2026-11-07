/** Display formatting, kept in one place so every screen speaks the same way. */

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat('en-CA');
const closeTime = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatMoney(amount: number): string {
  return money.format(amount);
}

const cents = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

/** "$4.21", for small amounts where the cents matter (e.g. a floor plan's daily interest). */
export function formatCents(amount: number): string {
  return cents.format(amount);
}

export function formatKm(km: number): string {
  return `${integer.format(km)} km`;
}

const day = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });

/** "Nov 5" */
export function formatDay(time: number | string): string {
  return day.format(new Date(time));
}

export function formatDateTime(iso: string): string {
  return closeTime.format(new Date(iso));
}

export function formatRelative(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const PROVINCE_CODES: Record<string, string> = {
  Alberta: 'AB',
  'British Columbia': 'BC',
  Manitoba: 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Nova Scotia': 'NS',
  Ontario: 'ON',
  'Prince Edward Island': 'PE',
  Quebec: 'QC',
  Saskatchewan: 'SK',
};

export function provinceCode(province: string): string {
  return PROVINCE_CODES[province] ?? province;
}

/** "gasoline" → "Gasoline", "single-speed" → "Single-speed"; leaves "SUV", "AWD", "CVT" alone. */
export function humanize(value: string): string {
  if (value === value.toUpperCase()) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function vehicleName(vehicle: { year: number; make: string; model: string }): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

export interface GradeBand {
  label: string;
  tone: 'success' | 'primary' | 'warning' | 'danger';
}

/** Condition grades run 1.0–5.0, like a wholesale condition report. */
export function gradeBand(grade: number): GradeBand {
  if (grade >= 4.5) return { label: 'Excellent', tone: 'success' };
  if (grade >= 3.5) return { label: 'Good', tone: 'success' };
  if (grade >= 2.5) return { label: 'Fair', tone: 'warning' };
  if (grade >= 1.5) return { label: 'Poor', tone: 'danger' };
  return { label: 'Rough', tone: 'danger' };
}

/** "420 km" by road, "352 km away" for a straight-line fallback, or "Near you" in the same city. */
export function formatDistance(km: number, basis: 'road' | 'straight_line' | null = null): string {
  if (km < 5) return 'Near you';
  return basis === 'road' ? `${integer.format(km)} km` : `${integer.format(km)} km away`;
}

/** Long-form age for prose: "3 hours ago", "yesterday", "4 days ago". */
export function formatAge(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

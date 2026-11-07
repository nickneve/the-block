/**
 * "Add to calendar" for an auction's close. Google and Outlook take a link;
 * Apple Calendar and desktop Outlook take an .ics file. The event starts a
 * little before the close so there's time to get to the bid panel.
 */
export interface CalendarEvent {
  title: string;
  details: string;
  location: string;
  /** Where the lot lives, so the event links straight back to it. */
  url: string;
  start: Date;
  end: Date;
}

/** Join this many minutes before bidding closes. */
export const LEAD_MINUTES = 15;

export function auctionCloseEvent(lot: {
  name: string;
  lot: string;
  closesAt: string;
  location: string;
  url: string;
}): CalendarEvent {
  const end = new Date(lot.closesAt);
  const start = new Date(end.getTime() - LEAD_MINUTES * 60_000);
  return {
    title: `Auction closes: ${lot.name} (Lot ${lot.lot})`,
    details: `Bidding on The Block closes at the end of this event. A bid in the final 2 minutes extends the close by 2 minutes.\n\n${lot.url}`,
    location: lot.location,
    url: lot.url,
    start,
    end,
  };
}

/** 2026-11-05T15:01:00.000Z → 20261105T150100Z */
function compactUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${compactUtc(event.start)}/${compactUtc(event.end)}`,
    details: event.details,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Outlook on the web; `office` for work and school accounts (Microsoft 365). */
export function outlookUrl(event: CalendarEvent, host: 'live' | 'office' = 'live'): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
    body: event.details,
    location: event.location,
  });
  return `https://outlook.${host === 'live' ? 'live' : 'office'}.com/calendar/0/deeplink/compose?${params}`;
}

/** Escapes text for an iCalendar property value (RFC 5545 §3.3.11). */
function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** A one-event .ics file, with a reminder when the event starts. */
export function icsFile(event: CalendarEvent, now: Date = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Block//Auction reminders//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${compactUtc(event.end)}-${encodeURIComponent(event.url)}@the-block`,
    `DTSTAMP:${compactUtc(now)}`,
    `DTSTART:${compactUtc(event.start)}`,
    `DTEND:${compactUtc(event.end)}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(event.details)}`,
    `LOCATION:${icsText(event.location)}`,
    `URL:${event.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(event.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

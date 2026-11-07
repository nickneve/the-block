import { auctionCloseEvent, googleCalendarUrl, icsFile, LEAD_MINUTES, outlookUrl } from './calendar';

describe('calendar', () => {
  const event = auctionCloseEvent({
    name: '2019 Chevrolet Equinox LS',
    lot: 'A-0002',
    closesAt: '2026-11-05T20:01:00.000Z',
    location: 'Golden Horseshoe Motors, London, ON',
    url: 'http://localhost:4200/vehicles/v1',
  });

  it('starts the event a little before bidding closes', () => {
    expect(event.end.toISOString()).toBe('2026-11-05T20:01:00.000Z');
    expect(event.end.getTime() - event.start.getTime()).toBe(LEAD_MINUTES * 60_000);
    expect(event.title).toBe('Auction closes: 2019 Chevrolet Equinox LS (Lot A-0002)');
  });

  it('builds a Google Calendar link with UTC times', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261105T194600Z/20261105T200100Z');
    expect(url.searchParams.get('text')).toContain('Lot A-0002');
  });

  it('builds Outlook links for personal and work accounts', () => {
    expect(new URL(outlookUrl(event)).hostname).toBe('outlook.live.com');
    const office = new URL(outlookUrl(event, 'office'));
    expect(office.hostname).toBe('outlook.office.com');
    expect(office.searchParams.get('startdt')).toBe('2026-11-05T19:46:00.000Z');
  });

  it('writes a valid single-event .ics file, escaping commas and new lines', () => {
    const ics = icsFile(event, new Date('2026-11-04T12:00:00.000Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261105T194600Z');
    expect(ics).toContain('LOCATION:Golden Horseshoe Motors\\, London\\, ON');
    expect(ics).toContain('DESCRIPTION:Bidding on The Block');
    expect(ics).toMatch(/DESCRIPTION:[^\r]*\\n\\nhttp:\/\/localhost:4200\/vehicles\/v1/);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});

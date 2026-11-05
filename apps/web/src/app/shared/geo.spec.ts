import { mapsUrl, roundCoordinate } from './geo';

describe('geo', () => {
  it('rounds shared coordinates to about a kilometre', () => {
    expect(roundCoordinate(43.452318)).toBe(43.45);
    expect(roundCoordinate(-80.49671)).toBe(-80.5);
  });

  it('links a dealership city to Google Maps', () => {
    expect(mapsUrl("St. John's", 'Newfoundland and Labrador')).toBe(
      "https://www.google.com/maps/search/?api=1&query=St.%20John's%2C%20Newfoundland%20and%20Labrador%2C%20Canada",
    );
  });
});

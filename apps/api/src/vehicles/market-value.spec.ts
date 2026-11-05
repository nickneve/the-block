import { depreciation, estimateMarketValue, MarketValueInput, mileageFactor, segmentBase } from './market-value';

const civic: MarketValueInput = {
  year: 2022,
  make: 'Honda',
  model: 'Civic',
  odometerKm: 70_000,
  conditionGrade: 4,
  titleStatus: 'clean',
};

describe('estimateMarketValue', () => {
  it('prices a typical vehicle from its segment, age, mileage, condition and title', () => {
    // 32,500 × 0.62 (4 years old) × 1 (average km) × 0.98 (grade 4) × 1 (clean) ≈ 19,747
    expect(estimateMarketValue(civic, 2026)).toEqual({ value: 19_700, low: 18_250, high: 21_000 });
  });

  it('is deterministic: the same vehicle always gets the same value', () => {
    expect(estimateMarketValue(civic, 2026)).toEqual(estimateMarketValue({ ...civic }, 2026));
  });

  it('values lower mileage, better condition and newer cars higher', () => {
    const base = estimateMarketValue(civic, 2026).value;
    expect(estimateMarketValue({ ...civic, odometerKm: 30_000 }, 2026).value).toBeGreaterThan(base);
    expect(estimateMarketValue({ ...civic, odometerKm: 140_000 }, 2026).value).toBeLessThan(base);
    expect(estimateMarketValue({ ...civic, conditionGrade: 4.8 }, 2026).value).toBeGreaterThan(base);
    // Newer, at typical mileage for its age (the same 70,000 km would be high for a 2-year-old car).
    expect(estimateMarketValue({ ...civic, year: 2024, odometerKm: 36_000 }, 2026).value).toBeGreaterThan(base);
  });

  it('discounts branded titles heavily', () => {
    const clean = estimateMarketValue(civic, 2026).value;
    const rebuilt = estimateMarketValue({ ...civic, titleStatus: 'rebuilt' }, 2026).value;
    const salvage = estimateMarketValue({ ...civic, titleStatus: 'salvage' }, 2026).value;
    expect(rebuilt).toBeLessThan(clean);
    expect(salvage).toBeLessThan(rebuilt);
  });

  it('ages a vehicle as the calendar moves on', () => {
    expect(estimateMarketValue(civic, 2027).value).toBeLessThan(estimateMarketValue(civic, 2026).value);
  });

  it('gives a range that brackets the estimate', () => {
    const { value, low, high } = estimateMarketValue({ ...civic, make: 'Tesla', model: 'Model S' }, 2026);
    expect(low).toBeLessThan(value);
    expect(high).toBeGreaterThan(value);
    expect(low % 250).toBe(0);
    expect(value % 100).toBe(0);
  });
});

describe('valuation factors', () => {
  it('matches the most specific segment first', () => {
    expect(segmentBase('Tesla', 'Model S')).toBe(102_500);
    expect(segmentBase('Tesla', 'Model 3')).toBe(62_500);
    expect(segmentBase('Ford', 'F-150')).toBe(65_000);
    expect(segmentBase('Kia', 'Forte')).toBe(32_500);
  });

  it('depreciates fastest in the first years, with a floor', () => {
    expect(depreciation(0)).toBeGreaterThan(depreciation(1));
    expect(depreciation(1) - depreciation(2)).toBeGreaterThan(depreciation(5) - depreciation(6));
    expect(depreciation(40)).toBe(0.3);
  });

  it('compares mileage with about 18,000 km a year', () => {
    expect(mileageFactor(20_000, 3)).toBe(1.05);
    expect(mileageFactor(54_000, 3)).toBe(1);
    expect(mileageFactor(100_000, 3)).toBe(0.8);
    // A brand-new car is judged against a 5,000 km allowance, not zero.
    expect(mileageFactor(4_500, 0)).toBe(1);
  });
});

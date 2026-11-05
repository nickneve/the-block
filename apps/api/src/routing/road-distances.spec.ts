import { CITY_COORDINATES } from '../database/seed/city-coordinates';
import { osrmRouteTable, RoadDistancesService, RouteTable } from './road-distances';

const buffalo = { lat: 42.89, lng: -78.88 };
const cityCount = Object.keys(CITY_COORDINATES).length;

describe('RoadDistancesService', () => {
  it('maps driving km to each dealership city and skips cities with no route', async () => {
    const table: RouteTable = (_origin, destinations) =>
      Promise.resolve(destinations.map((_, i) => (i === 0 ? null : 100 + i)));
    const roads = await new RoadDistancesService(table).fromOrigin(buffalo);

    expect(Object.keys(roads!)).toHaveLength(cityCount - 1);
    expect(roads!['Windsor, Ontario']).toBeGreaterThan(100);
  });

  it('asks the routing service once per location, even for concurrent requests', async () => {
    const table = jest.fn<ReturnType<RouteTable>, Parameters<RouteTable>>((_origin, destinations) =>
      Promise.resolve(destinations.map(() => 250)),
    );
    const service = new RoadDistancesService(table);

    await Promise.all([service.fromOrigin(buffalo), service.fromOrigin({ lat: 42.891, lng: -78.879 })]);
    await service.fromOrigin(buffalo);
    expect(table).toHaveBeenCalledTimes(1);

    await service.fromOrigin({ lat: 43.45, lng: -80.49 });
    expect(table).toHaveBeenCalledTimes(2);
  });

  it('falls back to straight-line when routing fails or is turned off', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = new RoadDistancesService(() => Promise.reject(new Error('timeout')));
    await expect(failing.fromOrigin(buffalo)).resolves.toBeNull();
    await expect(new RoadDistancesService(null).fromOrigin(buffalo)).resolves.toBeNull();
  });
});

describe('osrmRouteTable', () => {
  it('requests one row from the buyer and converts metres to km', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: 'Ok', distances: [[0, 409_000, null]] }),
    });
    const table = osrmRouteTable('https://osrm.test', fetchFn as unknown as typeof fetch);

    const km = await table(buffalo, [
      { lat: 42.315, lng: -83.036 },
      { lat: 48.428, lng: -123.366 },
    ]);

    expect(km).toEqual([409, null]);
    expect(String(fetchFn.mock.calls[0][0])).toBe(
      'https://osrm.test/table/v1/driving/-78.88,42.89;-83.036,42.315;-123.366,48.428?sources=0&annotations=distance',
    );
  });

  it('rejects when the service reports an error', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ code: 'NoTable' }) });
    await expect(osrmRouteTable('https://osrm.test', fetchFn as unknown as typeof fetch)(buffalo, [buffalo])).rejects.toThrow(
      'NoTable',
    );
  });
});

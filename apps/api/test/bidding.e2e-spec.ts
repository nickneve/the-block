import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Clock } from '../src/common/clock';
import { APP_CONFIG, loadConfig } from '../src/config/app-config';
import { CITY_COORDINATES } from '../src/database/seed/city-coordinates';
import { ROUTE_TABLE, RouteTable } from '../src/routing/road-distances';
import type { SavedSearchDto } from '../src/saved-searches/saved-searches.service';
import type { FacetsDto, VehicleDetailDto, VehiclePageDto, VehicleSummaryDto } from '../src/vehicles/vehicle.dto';

class FakeClock extends Clock {
  current = Date.parse('2026-11-04T15:00:00');
  override now(): number {
    return this.current;
  }
}

const BUYER = 'test-buyer-0001';
const OTHER_BUYER = 'test-buyer-0002';

describe('The Block API (e2e)', () => {
  let app: INestApplication;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue({ ...loadConfig(), dbPath: ':memory:', simulateBidding: false, routingUrl: null })
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  async function findLot(query: string, predicate: (lot: VehicleSummaryDto) => boolean): Promise<VehicleSummaryDto> {
    const { body } = await api().get(`/api/vehicles?pageSize=100&${query}`).expect(200);
    const lot = (body as VehiclePageDto).items.find(predicate);
    if (!lot) throw new Error(`No lot matched for query "${query}"`);
    return lot;
  }

  describe('browsing', () => {
    it('lists open lots by default, soonest-closing first, with tab counts', async () => {
      const { body } = await api().get('/api/vehicles').expect(200);
      const page = body as VehiclePageDto;

      expect(page.items).toHaveLength(24);
      expect(page.items.every((lot) => lot.auction.status === 'open')).toBe(true);
      const closeTimes = page.items.map((lot) => Date.parse(lot.auction.closesAt));
      expect(closeTimes).toEqual([...closeTimes].sort((a, b) => a - b));
      expect(page.statusCounts.open + page.statusCounts.ended).toBe(200);
      expect(page.statusCounts.ended).toBeGreaterThan(0);
    });

    it('searches across make, model and more', async () => {
      const { body } = await api().get('/api/vehicles?q=bronco&status=all').expect(200);
      const page = body as VehiclePageDto;
      expect(page.total).toBeGreaterThan(0);
      expect(page.items.every((lot) => lot.model === 'Bronco')).toBe(true);
    });

    it('filters by title status and validates query params', async () => {
      const { body } = await api().get('/api/vehicles?titleStatus=salvage&status=all').expect(200);
      expect((body as VehiclePageDto).items.every((lot) => lot.titleStatus === 'salvage')).toBe(true);

      const invalid = await api().get('/api/vehicles?sort=cheapest').expect(400);
      expect(invalid.body.code).toBe('VALIDATION_FAILED');
    });

    it('sorts newly listed lots first, and every lot was listed before its first bid', async () => {
      const { body } = await api().get('/api/vehicles?sort=listed_desc&pageSize=100').expect(200);
      const page = body as VehiclePageDto;
      const listed = page.items.map((lot) => Date.parse(lot.listedAt));

      expect(listed).toEqual([...listed].sort((a, b) => b - a));
      expect(listed.every((time) => time < clock.current)).toBe(true);

      const lot = page.items.find((candidate) => candidate.auction.bidCount > 0)!;
      const detail = (await api().get(`/api/vehicles/${lot.id}`).expect(200)).body as VehicleDetailDto;
      const firstBid = Math.min(...detail.recentBids.map((bid) => Date.parse(bid.placedAt)));
      expect(firstBid).toBeGreaterThan(Date.parse(lot.listedAt));
    });

    it('sorts by distance from the buyer when they share a location', async () => {
      const halifax = '44.65,-63.58';
      const { body } = await api().get('/api/vehicles?sort=distance&pageSize=10').set('X-Buyer-Location', halifax).expect(200);
      const items = (body as VehiclePageDto).items;

      const distances = items.map((lot) => lot.distanceKm!);
      expect(distances.every((km) => typeof km === 'number')).toBe(true);
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
      expect(items[0].province).toBe('Nova Scotia');
      expect(items[0].distanceBasis).toBe('straight_line');
    });

    it('ignores a missing or malformed location instead of failing', async () => {
      for (const header of [undefined, 'somewhere', '999,999']) {
        const request = api().get('/api/vehicles?sort=distance&pageSize=5');
        if (header) request.set('X-Buyer-Location', header);
        const { body } = await request.expect(200);
        expect((body as VehiclePageDto).items.every((lot) => lot.distanceKm === null)).toBe(true);
      }
    });

    it('measures distance from a buyer outside Canada too', async () => {
      const buffalo = '42.89,-78.88';
      const { body } = await api().get('/api/vehicles?sort=distance&pageSize=5').set('X-Buyer-Location', buffalo).expect(200);
      const nearest = (body as VehiclePageDto).items[0];

      expect(nearest.province).toBe('Ontario');
      expect(nearest.distanceKm).toBeLessThan(150);
    });

    it('counts filter options against the other active filters', async () => {
      const sum = (options: { count: number }[]) => options.reduce((total, option) => total + option.count, 0);
      const all = (await api().get('/api/vehicles/facets').expect(200)).body as FacetsDto;
      const ford = (await api().get('/api/vehicles/facets?make=Ford').expect(200)).body as FacetsDto;
      const { body: fordLots } = await api().get('/api/vehicles?make=Ford&pageSize=1').expect(200);
      const fordTotal = (fordLots as VehiclePageDto).total;

      // Other groups narrow to Ford…
      expect(sum(ford.bodyStyles)).toBe(fordTotal);
      expect(sum(ford.titleStatuses)).toBe(fordTotal);
      expect(ford.flags.noReserve).toBeLessThanOrEqual(fordTotal);
      // …while the make list itself ignores the make filter, so another make can be added.
      expect(ford.makes).toEqual(all.makes);
      // Options never disappear; they just count zero.
      expect(ford.bodyStyles.map((option) => option.value)).toEqual(all.bodyStyles.map((option) => option.value));
      // The page summary counts the whole auction regardless of filters.
      expect(ford.totals).toEqual(all.totals);
      expect(all.totals.all).toBe(200);
    });

    it('estimates a market value for every lot without using the reserve', async () => {
      const { body } = await api().get('/api/vehicles?status=all&pageSize=100').expect(200);
      for (const lot of (body as VehiclePageDto).items) {
        const { value, low, high } = lot.marketValue;
        expect(low).toBeLessThan(value);
        expect(high).toBeGreaterThan(value);
        if (lot.titleStatus === 'salvage') expect(value).toBeLessThan(40_000);
      }
    });

    it('returns full detail with seeded bid history', async () => {
      const lot = await findLot('status=open', (candidate) => candidate.auction.bidCount > 3);
      const { body } = await api().get(`/api/vehicles/${lot.id}`).expect(200);
      const detail = body as VehicleDetailDto;

      expect(detail.images.length).toBeGreaterThan(0);
      expect(detail.recentBids).toHaveLength(Math.min(lot.auction.bidCount, 25));
      expect(detail.recentBids[0].amount).toBe(lot.auction.currentBid);
    });
  });

  describe('bidding', () => {
    it('accepts a bid at the minimum and makes the buyer the high bidder', async () => {
      const lot = await findLot('status=open', (candidate) => candidate.auction.currentBid !== null);

      const { body } = await api()
        .post(`/api/vehicles/${lot.id}/bids`)
        .set('X-Bidder-Id', BUYER)
        .send({ amount: lot.auction.minNextBid })
        .expect(201);
      const detail = body as VehicleDetailDto;

      expect(detail.auction.currentBid).toBe(lot.auction.minNextBid);
      expect(detail.auction.bidCount).toBe(lot.auction.bidCount + 1);
      expect(detail.myStatus).toBe('winning');
      expect(detail.recentBids[0]).toMatchObject({ amount: lot.auction.minNextBid, isYou: true });
    });

    it('rejects a bid below the minimum and tells the buyer the new minimum', async () => {
      const lot = await findLot('status=open', (candidate) => candidate.auction.currentBid !== null);

      const { body } = await api()
        .post(`/api/vehicles/${lot.id}/bids`)
        .set('X-Bidder-Id', BUYER)
        .send({ amount: lot.auction.currentBid })
        .expect(400);

      expect(body).toMatchObject({ code: 'BID_TOO_LOW', details: { minNextBid: lot.auction.minNextBid } });
    });

    it('stops buyers from outbidding themselves, but lets others outbid them', async () => {
      const lot = await findLot('status=open', () => true);
      await api().post(`/api/vehicles/${lot.id}/bids`).set('X-Bidder-Id', BUYER).send({ amount: lot.auction.minNextBid }).expect(201);

      const again = await api().get(`/api/vehicles/${lot.id}`).set('X-Bidder-Id', BUYER).expect(200);
      const next = (again.body as VehicleDetailDto).auction.minNextBid;

      const self = await api().post(`/api/vehicles/${lot.id}/bids`).set('X-Bidder-Id', BUYER).send({ amount: next }).expect(409);
      expect(self.body.code).toBe('ALREADY_HIGH_BIDDER');

      await api().post(`/api/vehicles/${lot.id}/bids`).set('X-Bidder-Id', OTHER_BUYER).send({ amount: next }).expect(201);
      const mine = await api().get(`/api/vehicles/${lot.id}`).set('X-Bidder-Id', BUYER).expect(200);
      expect((mine.body as VehicleDetailDto).myStatus).toBe('outbid');
    });

    it('rejects bids on closed lots', async () => {
      const lot = await findLot('status=ended', () => true);
      const { body } = await api()
        .post(`/api/vehicles/${lot.id}/bids`)
        .set('X-Bidder-Id', BUYER)
        .send({ amount: lot.auction.minNextBid })
        .expect(409);
      expect(body.code).toBe('AUCTION_CLOSED');
    });

    it('extends the close when a bid lands in the final two minutes', async () => {
      const lot = await findLot('status=open', () => true);
      clock.current = Date.parse(lot.auction.closesAt) - 30_000;

      const { body } = await api()
        .post(`/api/vehicles/${lot.id}/bids`)
        .set('X-Bidder-Id', BUYER)
        .send({ amount: lot.auction.minNextBid })
        .expect(201);
      const detail = body as VehicleDetailDto;

      expect(detail.auction.extended).toBe(true);
      expect(Date.parse(detail.auction.closesAt)).toBe(clock.current + 2 * 60_000);
    });

    it('requires an anonymous bidder id to bid', async () => {
      const lot = await findLot('status=open', () => true);
      const { body } = await api().post(`/api/vehicles/${lot.id}/bids`).send({ amount: lot.auction.minNextBid }).expect(400);
      expect(body.code).toBe('BIDDER_ID_REQUIRED');
    });

    it('sells the lot immediately with Buy Now', async () => {
      const lot = await findLot('status=open&buyNow=true', (candidate) => candidate.auction.buyNowAvailable);

      const { body } = await api().post(`/api/vehicles/${lot.id}/buy-now`).set('X-Bidder-Id', BUYER).expect(200);
      const detail = body as VehicleDetailDto;

      expect(detail.auction).toMatchObject({ status: 'ended', outcome: 'sold', soldViaBuyNow: true, currentBid: lot.auction.buyNowPrice });
      expect(detail.myStatus).toBe('won');

      const second = await api().post(`/api/vehicles/${lot.id}/buy-now`).set('X-Bidder-Id', OTHER_BUYER).expect(409);
      expect(second.body.code).toBe('BUY_NOW_UNAVAILABLE');
    });
  });

  describe('my bids and watchlist', () => {
    it('tracks lots the buyer bid on and watches', async () => {
      const lot = await findLot('status=open', () => true);

      await api().put(`/api/me/watchlist/${lot.id}`).set('X-Bidder-Id', BUYER).expect(204);
      const watchlist = await api().get('/api/me/watchlist').set('X-Bidder-Id', BUYER).expect(200);
      expect((watchlist.body as VehicleSummaryDto[]).map((item) => item.id)).toEqual([lot.id]);

      const watchedOnly = await api().get('/api/vehicles?watched=true').set('X-Bidder-Id', BUYER).expect(200);
      expect((watchedOnly.body as VehiclePageDto).items.map((item) => item.id)).toEqual([lot.id]);

      await api().post(`/api/vehicles/${lot.id}/bids`).set('X-Bidder-Id', BUYER).send({ amount: lot.auction.minNextBid }).expect(201);
      const bids = await api().get('/api/me/bids').set('X-Bidder-Id', BUYER).expect(200);
      expect(bids.body).toEqual([expect.objectContaining({ id: lot.id, myStatus: 'winning', myMaxBid: lot.auction.minNextBid })]);

      await api().delete(`/api/me/watchlist/${lot.id}`).set('X-Bidder-Id', BUYER).expect(204);
      const after = await api().get('/api/me/watchlist').set('X-Bidder-Id', BUYER).expect(200);
      expect(after.body).toEqual([]);
    });
  });

  describe('saved searches', () => {
    const saved = () => api().get('/api/me/saved-searches').set('X-Bidder-Id', BUYER).expect(200);

    it('saves a search with match counts, renames on re-save, and deletes', async () => {
      const created = await api()
        .post('/api/me/saved-searches')
        .set('X-Bidder-Id', BUYER)
        .send({ name: 'Ford trucks', query: { make: 'Ford', bodyStyle: 'truck', sort: 'closing' } })
        .expect(201);
      const search = created.body as SavedSearchDto;

      const expected = await api().get('/api/vehicles?make=Ford&bodyStyle=truck').expect(200);
      expect(search).toMatchObject({
        name: 'Ford trucks',
        query: { bodyStyle: 'truck', make: 'Ford' },
        matchCount: (expected.body as VehiclePageDto).total,
      });

      // Same criteria in a different order: one saved search, renamed.
      await api()
        .post('/api/me/saved-searches')
        .set('X-Bidder-Id', BUYER)
        .send({ name: 'Trucks — Ford', query: { bodyStyle: 'truck', make: 'Ford' } })
        .expect(201);
      expect((await saved()).body).toEqual([expect.objectContaining({ id: search.id, name: 'Trucks — Ford' })]);

      // Other buyers never see it.
      const other = await api().get('/api/me/saved-searches').set('X-Bidder-Id', OTHER_BUYER).expect(200);
      expect(other.body).toEqual([]);

      await api().delete(`/api/me/saved-searches/${search.id}`).set('X-Bidder-Id', BUYER).expect(204);
      expect((await saved()).body).toEqual([]);
    });

    it('counts matches listed in the last day as new', async () => {
      const { body } = await api()
        .post('/api/me/saved-searches')
        .set('X-Bidder-Id', BUYER)
        .send({ name: 'Fresh', query: { sort: 'listed_desc' } })
        .expect(201);
      const page = (await api().get('/api/vehicles?sort=listed_desc&pageSize=100').expect(200)).body as VehiclePageDto;
      const fresh = page.items.filter((lot) => clock.current - Date.parse(lot.listedAt) < 24 * 60 * 60 * 1000);

      expect((body as SavedSearchDto).newCount).toBe(fresh.length);
      expect((body as SavedSearchDto).newCount).toBeGreaterThan(0);
    });

    it('rejects searches it cannot run, and empty ones', async () => {
      const post = (body: object) => api().post('/api/me/saved-searches').set('X-Bidder-Id', BUYER).send(body).expect(400);

      expect((await post({ name: 'x', query: { sort: 'cheapest' } })).body.code).toBe('VALIDATION_FAILED');
      expect((await post({ name: 'x', query: { colour: 'red' } })).body.message).toMatch(/Unknown search parameter/);
      expect((await post({ name: 'x', query: {} })).body.message).toMatch(/Add a search term/);
      expect((await post({ name: '   ', query: { make: 'Kia' } })).body.message).toMatch(/name/);
    });
  });
});

describe('Driving distances (e2e)', () => {
  let app: INestApplication;
  const victoria = CITY_COORDINATES['Victoria, British Columbia'];
  /** A stand-in router: every city is 1,000 km away by road except Victoria, 5 km. */
  const table: RouteTable = (_origin, destinations) =>
    Promise.resolve(destinations.map((point) => (point.lat === victoria.lat && point.lng === victoria.lng ? 5 : 1000)));

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue({ ...loadConfig(), dbPath: ':memory:', simulateBidding: false, routingUrl: null })
      .overrideProvider(ROUTE_TABLE)
      .useValue(table)
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('sorts and labels lots by driving distance when routing answers', async () => {
    const halifax = '44.65,-63.58';
    const { body } = await request(app.getHttpServer())
      .get('/api/vehicles?sort=distance&pageSize=5')
      .set('X-Buyer-Location', halifax)
      .expect(200);
    const nearest = (body as VehiclePageDto).items[0];

    expect(nearest.city).toBe('Victoria');
    expect(nearest.distanceKm).toBe(5);
    expect(nearest.distanceBasis).toBe('road');

    const detail = (
      await request(app.getHttpServer()).get(`/api/vehicles/${nearest.id}`).set('X-Buyer-Location', halifax).expect(200)
    ).body as VehicleDetailDto;
    expect(detail.distanceKm).toBe(5);
  });
});

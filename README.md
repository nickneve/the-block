# The Block

**A buyer-side vehicle auction prototype.** Search 200 dealer vehicles, inspect their condition and damage, and bid in live auctions that update in every open tab.

Angular 21 · NestJS 11 · SQLite. The original brief is in [`docs/CHALLENGE.md`](docs/CHALLENGE.md).

<p align="center">
  <img src="docs/screenshots/inventory-light.png" alt="Search: sort tabs, filters with live counts, and cards with colour-tinted photos and a price bar on each photo" width="860" />
</p>

<p align="center">
  <img src="docs/screenshots/detail-light.png" alt="Vehicle detail: gallery, market value estimate and the bid panel" width="425" />
  <img src="docs/screenshots/confirm-bid.png" alt="Placing a bid: how you'll pay (in-house financing, another lender or pay in full), pickup or flatbed delivery, and the total if you win" width="425" />
</p>

---

## How to Run

**Requirements:** Node.js **20.19+, 22.12+ or 24+** (see `.nvmrc`) and npm. You don't need Docker, a database server or any env vars.

```bash
npm install     # installs both apps (npm workspaces)
npm run dev     # API on :3000 + Angular dev server on :4200
```

Open **http://localhost:4200**. On first start, the API creates a SQLite database from `data/vehicles.json`, with auction times re-anchored to the current time.

| Command | What it does |
|---|---|
| `npm run dev` | API (watch mode) and Angular dev server with live reload |
| `npm start` | Production build of both apps, served from one port: http://localhost:3000 |
| `npm test` | API unit and e2e tests (Jest), then web unit tests (Vitest) |
| `npm run db:reset` | Deletes the database so the next start re-seeds it with fresh auction times. Stop the API first. |

**Good to know**
- **Every lot shows as ended?** Auctions run for about six days from the first start. Stop the API, run `npm run db:reset`, and start again.
- **`better-sqlite3` fails to install?** Prebuilt binaries cover current Node versions on macOS, Linux and Windows. Otherwise, switch to Node 22 or 24, or install build tools (Xcode CLT, `build-essential` or VS Build Tools).
- **Rival bidders** answer your bids so the auction feels live. Set `SIMULATE_BIDDING=false` to turn them off.
- ***Closest to me*** looks up places and driving distances with the free public Photon and OSRM services, so it needs internet. If routing can't be reached, distances fall back to a straight line, labelled "km away".

## Time Spent

_TODO (author): add your time._

I built it in cut-line order, so each step left a working app: scaffold and seed, browse, detail, then bid. That met the minimum bar before I started any extras. Live updates, My bids and polish came next, followed by several rounds of changes from my own review.

## Assumptions and Scope

**Included**
- **Browse and search:**
  - Free-text search, filters with live counts, and sorts, including one-tap quick sorts.
  - A photo grid and a dense list view, with infinite scroll.
  - Filters live in the URL.
- **Vehicle detail:** photos (with a full-screen viewer), specs, condition grade and report, damage notes sorted by severity, the selling dealership and the bid history.
- **Bidding:** tiered increments, a confirmation step, soft close, Buy Now, and server-side validation of every bid. The price, your status and the history update live.
- **Desktop and mobile:** responsive from phones to 1440p monitors, with light and dark themes.
- **Beyond the brief:**
  - Simulated rival bidders.
  - A simulated sign-in, with payment and delivery questions at confirmation.
  - *My bids* and a watchlist.
  - Saved searches.
  - An estimated market value.
  - *Closest to me*.

**Assumptions**
- **No real accounts.** Each browser gets an anonymous buyer id, so a private window counts as a second buyer. Sign-in is simulated, and nothing is sent to a server.
- **Auction times are re-anchored to now.** The dataset's times are all in the past.
- **The reserve stays private.** Buyers see only *Reserve met*, *Reserve not met* or *No reserve*.
- **All prices are CAD.** The dealers are in Canada; buyers can be anywhere in Canada or the US.
- **The photos are placeholders,** tinted with each car's exterior colour to suggest a real photo.
- **Payment and delivery are simulated.** The options are in-house financing, another lender or pay in full, and pickup or a flatbed quote. No lender or carrier is contacted.
- **Market values are estimates** from a simple book-value model (segment, age, mileage, condition and title). They never use the reserve.
- **Listing dates are derived** (six to eight days before the close), because the dataset has none.
- **Distances are measured between city centres,** because the dataset has no street addresses.

**Skipped:** real authentication, proxy bidding, real payments and transport booking, seller and admin tools, push notifications, internationalization.

## Stack

- **Frontend:** Angular 21 (standalone components, signals, zoneless), Angular CDK, and hand-built SCSS design tokens. No UI kit.
- **Backend:** NestJS 11, `class-validator` DTOs, server-sent events for live updates.
- **Database:** SQLite via `better-sqlite3`, with hand-written SQL.
- **Tooling:** npm workspaces, Jest + supertest (API), Vitest (web).

## What I Built

An Angular app and a NestJS API in one npm workspace. The API owns the database and every auction rule. The web app renders what the API returns, and stays current over a live event stream.

```
apps/
  api/   NestJS: auctions (rules), bids, vehicles (search, filter counts, detail), bidders,
         saved-searches, events (live stream), simulator (rivals), routing (driving distances), database
  web/   Angular: core (API client, live updates, stores), layout, shared (UI pieces, formatting),
         features (inventory, vehicle-detail, my-bids, saved-searches)
data/vehicles.json   unchanged seed data
```

## Notable Decisions

**Product**
- **A car "runs on the block" at `auction_start`, and bidding is open until then.** If that time meant "bidding opens", most lots would be upcoming yet already have bids. On seed, the schedule shifts to now. A few lots have already closed, to show ended states, and the rest close over about six days.
- **Bidding built for trust.**
  - The reserve is never revealed.
  - A bid in the last two minutes extends the close by two minutes, so nobody can snipe.
  - Increments are tiered by price.
  - Every bid goes through a confirmation that restates the amount and flags risky bids: far above the minimum, more than Buy Now, or a salvage or rebuilt title.
- **Browse freely, sign in to bid.** Watching and saving searches commit nothing, so they don't need an account. A bid is binding, so a guest signs in first and then lands straight in the confirmation. The confirmation also asks how they'll pay and take delivery if they win.
- **Simulated rivals** answer about 75% of your bids within 4–15 seconds, so a solo demo shows outbid alerts and live updates. Each lot has a hidden ceiling, so you can still win.
- **Grid or list.** The grid is photo-first, like consumer auction sites. The list is a dense row per lot, like wholesale sites, for dealers who scan many lots. The app remembers which one you chose.
- **An estimated market value on every lot** answers a dealer's first question about a price: is it a good one? It's labelled as a prototype estimate.
- ***Closest to me* uses where you really are.** That's your device location or any place in Canada or the US. Distances are by road rather than straight lines, because pickup and transport are priced by road. The location is sent in a request header, not the URL, so it never ends up in a shared link.
- **Placeholder photos tinted with the car's colour,** so the grid isn't 200 identical grey boxes, and to preview how real photos would look.

**Technical**
- **The server is the source of truth.**
  - All bidding rules are pure functions in [`auction-rules.ts`](apps/api/src/auctions/auction-rules.ts).
  - Each bid's read, validate and write runs in one SQLite transaction.
  - Status, minimum bid and "my status" are computed when read, so they can't go stale.
- **SQLite and plain SQL, no ORM.** It needs no setup, and three tables don't need an ORM. Moving to Postgres would mean swapping the repositories.
- **Server-sent events, not WebSockets.** Updates only flow from server to client, and bids are ordinary POSTs. Browsers allow only about six connections per site over HTTP/1.1, so one tab per browser holds the stream and relays updates to the others.
- **Filters live in the URL,** so views can be shared and survive a refresh. Filtering, sorting, paging and the filter counts all run in SQL.

**Design:** a neutral canvas with one action colour.
- Orange is used only for bid, Buy Now and confirm; blue for navigation and selection.
- Light, dark, or follow the system.
- Text targets WCAG AA, and status is never shown by colour alone.

## Testing

```bash
npm test
```

- **API unit (Jest, 78):** every auction rule, schedule normalization, the seeded bid history, distances, saved-search keys and the market value model.
- **API end-to-end (Jest + supertest, 22):** the real app on an in-memory database with a controllable clock. They cover:
  - Search and filters.
  - Bids: accepted, too low, outbidding yourself, and a closed lot.
  - Soft close and Buy Now.
  - My bids, the watchlist and saved searches.
- **Web unit (Vitest, 97):** filters ⇄ URL, bid checks and confirmation warnings, merging live updates, the shared live stream, payment and delivery plans, calendar links, and the theme.
- **In the browser:** I drove each flow in headless Chrome at 375 to 2560 px in both themes, including:
  - Bidding as a guest.
  - Being outbid by a second buyer.
  - Eight tabs open at once.

## What I'd Do With More Time

- **Proxy (max) bidding,** which is standard in wholesale auctions.
- **Real accounts and dealer verification,** replacing the simulated sign-in.
- **What happens after a win:** financing paperwork, carrier booking and payment due dates, driven by the choices made when bidding.
- **A real valuation feed,** and a "furthest below market" sort built on it.
- **A shared API contract** generated from OpenAPI, instead of DTOs mirrored by hand.
- **Playwright end-to-end tests** and a screen-reader accessibility audit.

import { resolve } from 'node:path';

/** apps/api — this file lives two levels down in both src/ and dist/. */
const API_ROOT = resolve(__dirname, '..', '..');

export interface AppConfig {
  port: number;
  /** SQLite file path, or ":memory:" (used by tests). */
  dbPath: string;
  vehiclesJsonPath: string;
  /** Built Angular app, served by the API in single-port mode (`npm start`). */
  webDistPath: string;
  /** Background rival bidders that make the auction feel alive. */
  simulateBidding: boolean;
  /** OSRM server for driving distances; null uses straight-line distance only. */
  routingUrl: string | null;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    dbPath: env.DB_PATH ?? resolve(API_ROOT, 'data', 'auction.sqlite'),
    vehiclesJsonPath: env.VEHICLES_JSON ?? resolve(API_ROOT, '..', '..', 'data', 'vehicles.json'),
    webDistPath: env.WEB_DIST ?? resolve(API_ROOT, '..', 'web', 'dist', 'web', 'browser'),
    simulateBidding: env.SIMULATE_BIDDING !== 'false',
    routingUrl: env.ROUTING_URL === 'off' ? null : (env.ROUTING_URL ?? 'https://router.project-osrm.org'),
  };
}

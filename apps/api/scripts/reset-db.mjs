#!/usr/bin/env node
// Deletes the local SQLite database so the next API start re-seeds it from
// data/vehicles.json and re-anchors every auction close time relative to "now".
import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.DB_PATH ?? resolve(apiRoot, 'data', 'auction.sqlite');

let removed = 0;
for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (!existsSync(file)) continue;
  try {
    rmSync(file);
    removed += 1;
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EBUSY') {
      console.error('The database is in use — stop the API (Ctrl+C on "npm run dev") and run this again.');
      process.exit(1);
    }
    throw error;
  }
}

console.log(
  removed > 0
    ? `Removed ${dbPath}. Start the API again to re-seed with fresh auction times.`
    : `No database found at ${dbPath} — nothing to reset.`,
);

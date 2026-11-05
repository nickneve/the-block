#!/usr/bin/env node
/**
 * Runs an Angular CLI command, then exits as soon as it has finished.
 *
 * The stock `ng` binary sets process.exitCode and waits for Node's event loop to
 * drain. On some Windows + Node 24 setups esbuild's helper process keeps the loop
 * alive after a successful build, so `ng build` never returns and `npm start`
 * would never get on to starting the API. Exiting explicitly avoids that.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { default: runAngularCli } = require('@angular/cli');

const exitCode = await runAngularCli({ cliArgs: process.argv.slice(2) });
process.exit(exitCode ?? 0);

import { Injectable } from '@nestjs/common';

/**
 * Single source of "now" for the API. Injected everywhere time matters so
 * tests can freeze or advance time deterministically.
 */
@Injectable()
export class Clock {
  now(): number {
    return Date.now();
  }
}

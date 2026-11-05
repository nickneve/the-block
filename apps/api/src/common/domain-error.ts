import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'BIDDER_ID_REQUIRED'
  | 'VEHICLE_NOT_FOUND'
  | 'AUCTION_CLOSED'
  | 'BID_TOO_LOW'
  | 'BID_TOO_HIGH'
  | 'ALREADY_HIGH_BIDDER'
  | 'BUY_NOW_UNAVAILABLE'
  | 'SAVED_SEARCH_LIMIT'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** An expected, user-facing failure with a stable machine-readable code. */
export class DomainError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details } satisfies ErrorBody, status);
  }
}

import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '../common/domain-error';
import { isValidBidderId } from './bidder-identity';

export const BIDDER_ID_HEADER = 'x-bidder-id';

/**
 * Resolves the anonymous buyer from the `X-Bidder-Id` header.
 * `@BidderId()` → string | null; `@BidderId({ required: true })` → string or 400.
 */
export const BidderId = createParamDecorator(
  (options: { required?: boolean } | undefined, context: ExecutionContext): string | null => {
    const value = context.switchToHttp().getRequest<Request>().header(BIDDER_ID_HEADER);

    if (value && isValidBidderId(value)) return value;

    if (options?.required) {
      throw new DomainError(
        'BIDDER_ID_REQUIRED',
        'Send an anonymous buyer id in the X-Bidder-Id header.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return null;
  },
);

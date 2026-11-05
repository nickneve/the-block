import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { GeoPoint, parseGeoPoint } from '../common/geo';

export const BUYER_LOCATION_HEADER = 'x-buyer-location';

/**
 * The buyer's approximate location ("lat,lng") from the `X-Buyer-Location`
 * header, or null. A header rather than a query param keeps it out of
 * shareable URLs, saved searches and access logs.
 */
export const BuyerLocation = createParamDecorator(
  (_options: unknown, context: ExecutionContext): GeoPoint | null =>
    parseGeoPoint(context.switchToHttp().getRequest<Request>().header(BUYER_LOCATION_HEADER)),
);

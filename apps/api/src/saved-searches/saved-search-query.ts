import { HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DomainError } from '../common/domain-error';
import { QueryVehiclesDto } from '../vehicles/dto/query-vehicles.dto';

/**
 * A saved search is stored as a canonical query string (the same params the
 * inventory URL uses), so saving the same search twice is detected no matter
 * what order the filters were picked in.
 */

const LIST_KEYS = ['make', 'bodyStyle', 'fuelType', 'province', 'titleStatus'] as const;
const VALUE_KEYS = ['q', 'minGrade', 'maxKm', 'yearMin', 'yearMax', 'priceMin', 'priceMax', 'status', 'sort'] as const;
const FLAG_KEYS = ['buyNow', 'noReserve', 'watched'] as const;
const DEFAULTS: Record<string, string> = { status: 'open', sort: 'closing' };

export type SearchParams = Record<string, string>;

/** Validates raw params and returns them in canonical form (sorted keys and values, defaults dropped). */
export function canonicalSearchParams(raw: Record<string, unknown>): SearchParams {
  const known = new Set<string>([...LIST_KEYS, ...VALUE_KEYS, ...FLAG_KEYS]);
  const unknown = Object.keys(raw).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw invalid(`Unknown search parameter${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.`);
  }

  const dto = plainToInstance(QueryVehiclesDto, raw);
  const errors = validateSync(dto);
  if (errors.length > 0) {
    throw invalid(errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; '));
  }

  const params: SearchParams = {};
  for (const key of LIST_KEYS) {
    const values = dto[key];
    if (values?.length) params[key] = [...new Set(values)].sort().join(',');
  }
  for (const key of VALUE_KEYS) {
    const value = dto[key];
    const text = typeof value === 'string' ? value.trim() : value === undefined ? '' : String(value);
    if (text !== '' && text !== DEFAULTS[key]) params[key] = text;
  }
  for (const key of FLAG_KEYS) {
    if (dto[key]) params[key] = 'true';
  }

  return Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
}

export function toQueryString(params: SearchParams): string {
  return new URLSearchParams(params).toString();
}

export function fromQueryString(query: string): SearchParams {
  return Object.fromEntries(new URLSearchParams(query));
}

/** The stored params as the DTO the vehicle search expects. */
export function toQueryDto(params: SearchParams): QueryVehiclesDto {
  return plainToInstance(QueryVehiclesDto, params);
}

function invalid(message: string): DomainError {
  return new DomainError('VALIDATION_FAILED', message, HttpStatus.BAD_REQUEST);
}

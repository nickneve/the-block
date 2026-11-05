import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SORT_KEYS,
  type SortKey,
  STATUS_FILTERS,
  type StatusFilter,
} from '../../database/repositories/vehicles.repository';

/** Accepts `?make=Ford&make=Kia` or `?make=Ford,Kia`. */
const toList = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((item) => String(item).trim()).filter(Boolean);
};

const toBoolean = ({ value }: { value: unknown }): boolean => value === true || value === 'true' || value === '1';

export class QueryVehiclesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional() @Transform(toList) @IsArray() @IsString({ each: true })
  make?: string[];

  @IsOptional() @Transform(toList) @IsArray() @IsString({ each: true })
  bodyStyle?: string[];

  @IsOptional() @Transform(toList) @IsArray() @IsString({ each: true })
  fuelType?: string[];

  @IsOptional() @Transform(toList) @IsArray() @IsString({ each: true })
  province?: string[];

  @IsOptional() @Transform(toList) @IsArray() @IsString({ each: true })
  titleStatus?: string[];

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5)
  minGrade?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  maxKm?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1900)
  yearMin?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1900)
  yearMax?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  priceMin?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  priceMax?: number;

  @IsOptional() @Transform(toBoolean) @IsBoolean()
  buyNow?: boolean;

  @IsOptional() @Transform(toBoolean) @IsBoolean()
  noReserve?: boolean;

  @IsOptional() @Transform(toBoolean) @IsBoolean()
  watched?: boolean;

  @IsOptional() @IsIn(STATUS_FILTERS)
  status: StatusFilter = 'open';

  @IsOptional() @IsIn(SORT_KEYS)
  sort: SortKey = 'closing';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 24;
}

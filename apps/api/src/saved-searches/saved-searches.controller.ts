import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';
import { BidderId } from '../bidders/bidder-id.decorator';
import { SavedSearchDto, SavedSearchesService } from './saved-searches.service';

export class CreateSavedSearchDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Give the search a name.' })
  @MaxLength(60)
  name: string;

  /** The inventory URL params, e.g. `{ make: 'Ford', sort: 'km_asc' }`. */
  @IsObject()
  query: Record<string, unknown>;
}

@Controller('me/saved-searches')
export class SavedSearchesController {
  constructor(private readonly savedSearches: SavedSearchesService) {}

  @Get()
  list(@BidderId({ required: true }) bidderId: string): SavedSearchDto[] {
    return this.savedSearches.list(bidderId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  save(@Body() body: CreateSavedSearchDto, @BidderId({ required: true }) bidderId: string): SavedSearchDto {
    return this.savedSearches.save(bidderId, body.name, body.query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @BidderId({ required: true }) bidderId: string): void {
    this.savedSearches.remove(bidderId, id);
  }
}

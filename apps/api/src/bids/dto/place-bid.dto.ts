import { IsInt, IsPositive } from 'class-validator';

export class PlaceBidDto {
  /** Whole dollars (CAD). */
  @IsInt({ message: 'Bid amount must be a whole-dollar number.' })
  @IsPositive()
  amount: number;
}

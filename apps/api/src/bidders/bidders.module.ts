import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { MeController } from './me.controller';

@Module({
  imports: [VehiclesModule],
  controllers: [MeController],
})
export class BiddersModule {}

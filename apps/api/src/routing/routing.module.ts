import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { osrmRouteTable, RoadDistancesService, ROUTE_TABLE } from './road-distances';

@Module({
  providers: [
    {
      provide: ROUTE_TABLE,
      useFactory: (config: AppConfig) => (config.routingUrl ? osrmRouteTable(config.routingUrl) : null),
      inject: [APP_CONFIG],
    },
    RoadDistancesService,
  ],
  exports: [RoadDistancesService],
})
export class RoutingModule {}

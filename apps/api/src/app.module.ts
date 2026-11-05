import { DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'node:fs';
import { AuctionsModule } from './auctions/auctions.module';
import { BiddersModule } from './bidders/bidders.module';
import { BidsModule } from './bids/bids.module';
import { loadConfig } from './config/app-config';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { SimulatorModule } from './simulator/simulator.module';
import { VehiclesModule } from './vehicles/vehicles.module';

/** In single-port mode (`npm start`) the API also serves the built Angular app. */
function staticWebApp(): DynamicModule[] {
  const { webDistPath } = loadConfig();
  if (!existsSync(webDistPath)) return [];
  return [ServeStaticModule.forRoot({ rootPath: webDistPath, exclude: ['/api/{*path}'] })];
}

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    VehiclesModule,
    BidsModule,
    BiddersModule,
    SavedSearchesModule,
    AuctionsModule,
    SimulatorModule,
    ...staticWebApp(),
  ],
})
export class AppModule {}

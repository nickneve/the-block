import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  const { port } = loadConfig();
  await app.listen(port);
  Logger.log(`The Block API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();

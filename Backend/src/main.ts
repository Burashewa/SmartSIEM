import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { setDefaultResultOrder } from 'node:dns';
import { AppModule } from './app.module';

// Avoid intermittent "fetch failed" to Google APIs on Windows (IPv6/DNS ordering).
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = Number(configService.get<string>('PORT') ?? 5001);

  app.enableCors({
    origin: true,
    credentials: false,
  });
  app.setGlobalPrefix('api');
  await app.listen(port);
}

bootstrap();

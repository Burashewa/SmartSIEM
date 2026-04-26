import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

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

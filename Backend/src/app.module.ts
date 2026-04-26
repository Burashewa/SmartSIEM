import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DashboardModule } from './dashboard/dashboard.module';
import { LogsModule } from './logs/logs.module';
import { AlertsModule } from './alerts/alerts.module';
import { RulesModule } from './rules/rules.module';
import { SystemModule } from './system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '..', '.env')],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      exclude: ['/api*'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const mongoUri =
          configService.get<string>('MONGODB_URI') ??
          configService.get<string>('Mongo_URI');

        if (!mongoUri) {
          throw new Error(
            'Missing MongoDB connection string. Set MONGODB_URI or Mongo_URI in the backend environment file.',
          );
        }

        return { uri: mongoUri };
      },
    }),
    LogsModule,
    AlertsModule,
    DashboardModule,
    RulesModule,
    SystemModule,
  ],
})
export class AppModule {}

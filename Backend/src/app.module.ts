import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { DashboardModule } from './dashboard/dashboard.module';
import { LogsModule } from './logs/logs.module';
import { AlertsModule } from './alerts/alerts.module';
import { RulesModule } from './rules/rules.module';
import { SystemModule } from './system/system.module';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { AlertAssistantModule } from './alert-assistant/alert-assistant.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';

/** Resolve .env regardless of whether the process was started from Backend/ or SmartSIEM/. */
function resolveEnvFilePaths(): string[] {
  const candidates = [
    join(__dirname, '..', '.env'),
    join(__dirname, '..', '..', '.env'),
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env'),
  ];
  return [...new Set(candidates.filter((path) => existsSync(path)))];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePaths(),
    }),
    ScheduleModule.forRoot(),
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

        const dbName = (configService.get<string>('DB_NAME') ?? 'SIEM')
          .replace(/^["']|["']$/g, '')
          .trim();

        return {
          uri: mongoUri,
          dbName,
          serverSelectionTimeoutMS: 10_000,
        };
      },
    }),
    LogsModule,
    AlertsModule,
    DashboardModule,
    RulesModule,
    SystemModule,
    AuthModule,
    AgentsModule,
    AlertAssistantModule,
    ReportsModule,
    AdminModule,
  ],
})
export class AppModule {}

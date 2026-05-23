import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Alert, AlertSchema } from './alert.schema';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { IpGeolocationService } from '../geo/ip-geolocation.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Alert.name, schema: AlertSchema }])],
  providers: [AlertsService, IpGeolocationService],
  controllers: [AlertsController],
  exports: [AlertsService, IpGeolocationService],
})
export class AlertsModule {}

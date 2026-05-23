import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Alert, AlertSchema } from '../alerts/alert.schema';
import { Log, LogSchema } from '../logs/log.schema';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Log.name, schema: LogSchema },
      { name: Alert.name, schema: AlertSchema },
    ]),
  ],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}

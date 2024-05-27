import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SchemaAppModule } from '@schema/schema-app';
import { TaskCronModule } from '@task-cron/task-cron';
import { WalletModule } from '@user-address/address';
import { UsersModule } from '@user-core/users';
import { SnipersModule } from '@user-sniper/snipers';
import { TasksModule } from '@user-task/tasks';

import { CronjobController } from './cronjob.controller';
import { CronjobService } from './cronjob.service';
import { SnipersQueryEvent } from './snipe-query-event.service';
import { DexSdkModule } from '@dex-sdk/dex-sdk';

@Module({
  imports: [
    HttpModule,
    SchemaAppModule,
    SnipersModule,
    TaskCronModule,
    TasksModule,
    UsersModule,
    WalletModule,
    DexSdkModule,
  ],
  controllers: [CronjobController],
  providers: [CronjobService, SnipersQueryEvent],
})
export class CronjobModule {}

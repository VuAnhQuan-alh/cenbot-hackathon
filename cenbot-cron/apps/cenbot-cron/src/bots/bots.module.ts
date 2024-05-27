import { DexSdkModule } from '@dex-sdk/dex-sdk';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CroDataModule } from '@task-cro/cro-data';
import { TaskCronModule } from '@task-cron/task-cron';
import { WalletModule } from '@user-address/address';
import { UsersModule } from '@user-core/users';
import { SnipersModule } from '@user-sniper/snipers';
import { TasksModule } from '@user-task/tasks';
import { TransactionsModule } from '@user-trans/transactions';

import { AwsUploadService } from './aws-upload.service';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';
import { ControlService } from './control.service';
import { MenuServices } from './menu.service';

@Module({
  imports: [
    MulterModule.register({}),
    UsersModule,
    TasksModule,
    WalletModule,
    TransactionsModule,
    HttpModule,
    TaskCronModule,
    SnipersModule,
    CroDataModule,
    DexSdkModule,
  ],
  controllers: [BotsController],
  providers: [BotsService, ControlService, MenuServices, AwsUploadService],
})
export class BotsModule {}

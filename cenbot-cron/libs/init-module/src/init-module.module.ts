import { DexSdkModule } from '@dex-sdk/dex-sdk';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CroDataModule } from '@task-cro/cro-data';
import { TaskCronModule } from '@task-cron/task-cron';
import { WalletModule } from '@user-address/address';
import { UsersModule } from '@user-core/users';
import { SnipersModule } from '@user-sniper/snipers';
import { TasksModule } from '@user-task/tasks';
import { TransactionsModule } from '@user-trans/transactions';

import { InitModuleService } from './init-module.service';

@Module({
  imports: [
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
  providers: [InitModuleService],
  exports: [InitModuleService],
})
export class InitModuleModule {}

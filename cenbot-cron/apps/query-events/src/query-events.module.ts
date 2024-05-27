import { DexSdkModule } from '@dex-sdk/dex-sdk';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SchemaAppModule } from '@schema/schema-app';
import { WalletModule } from '@user-address/address';
import { UsersModule } from '@user-core/users';
import { SnipersModule } from '@user-sniper/snipers';

import { QueryEventsController } from './query-events.controller';
import { QueryEventsService } from './query-events.service';

@Module({
  imports: [
    SchemaAppModule,
    UsersModule,
    WalletModule,
    SnipersModule,
    DexSdkModule,
    HttpModule,
  ],
  controllers: [QueryEventsController],
  providers: [QueryEventsService],
})
export class QueryEventsModule {}

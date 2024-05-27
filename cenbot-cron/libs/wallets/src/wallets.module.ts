import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Wallets,
  WalletsSchema,
} from '@schema/schema-app/schema/wallets.schema';

import { WalletsService } from './wallets.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Wallets.name, schema: WalletsSchema }]),
  ],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletModule {}

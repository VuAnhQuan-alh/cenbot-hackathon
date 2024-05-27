import { Module } from '@nestjs/common';

import { BotsService } from '../bots.service';
import { SnipeTokenService } from './snipe-token';
import { TransferTokenService } from './transfer-token';

@Module({
  imports: [BotsService],
  providers: [SnipeTokenService, TransferTokenService],
})
export class ActionsModule {}

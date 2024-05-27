import { Module } from '@nestjs/common';
import { SnipersService } from './snipers.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Snipers,
  SnipersSchema,
} from '@schema/schema-app/schema/sniper.schema';
import {
  Liquidities,
  LiquiditiesSchema,
} from '@schema/schema-app/schema/liquidity.schema';
import {
  Swapped,
  SwappedSchema,
} from '@schema/schema-app/schema/swapped.schema';
import { LiquiditiesService } from './liquidities.service';
import { SwappedService } from './swapped.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Snipers.name, schema: SnipersSchema },
      { name: Liquidities.name, schema: LiquiditiesSchema },
      { name: Swapped.name, schema: SwappedSchema },
    ]),
  ],
  providers: [SnipersService, LiquiditiesService, SwappedService],
  exports: [SnipersService, LiquiditiesService, SwappedService],
})
export class SnipersModule {}

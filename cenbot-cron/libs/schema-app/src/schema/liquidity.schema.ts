import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LiquiditiesDocs = HydratedDocument<Liquidities>;

@Schema({ timestamps: true, collection: 'liquidity' })
export class Liquidities {
  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  type: string;

  @Prop({ type: String })
  coin_x: string;

  @Prop({ type: String })
  coin_y: string;

  @Prop({ type: Number })
  amount_x: number;

  @Prop({ type: Number })
  amount_y: number;

  @Prop({ type: String })
  pool: string;

  @Prop({ type: String })
  sender: string;

  @Prop({ type: String, unique: true })
  hash: string;

  @Prop({ type: Boolean })
  isFirst: boolean;

  @Prop({ type: Number })
  timestampMs: number;
}

export const LiquiditiesSchema = SchemaFactory.createForClass(Liquidities);

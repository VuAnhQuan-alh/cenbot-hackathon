import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Users } from './users.schema';

export type SnipersDocs = HydratedDocument<Snipers>;

@Schema({ timestamps: true, collection: 'sniper' })
export class Snipers {
  @Prop({ required: true, type: Types.ObjectId, ref: Users.name })
  userId: Users;

  @Prop({ default: [], type: [String] })
  wallets: string[];

  @Prop({ type: String })
  token: string;

  @Prop({ default: false, type: Boolean })
  firstOfFail: boolean;

  @Prop({ default: false, type: Boolean })
  noSwap: boolean;

  @Prop({ default: false, type: Boolean })
  antiRug: boolean;

  @Prop({ nullable: true, default: null, type: String })
  maxSpend: string | null;

  @Prop({ nullable: true, default: null, type: String })
  autoSell: string | null;

  @Prop({ default: false, type: Boolean })
  swapped: boolean;

  @Prop({ type: String })
  swapDex: string;

  @Prop({ type: String })
  pool: string;

  @Prop({ type: Number, default: 0 })
  firstPrice: number;

  @Prop({ type: Number, default: 0 })
  lastPrice: number;

  @Prop({ type: String, default: '' })
  hash: string;

  @Prop({ type: String, default: '' })
  slippage: string;
}

export const SnipersSchema = SchemaFactory.createForClass(Snipers);

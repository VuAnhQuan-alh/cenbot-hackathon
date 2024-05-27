import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SwappedDocs = HydratedDocument<Swapped>;

@Schema({ timestamps: true, collection: 'swapped' })
export class Swapped {
  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  type: string;

  @Prop({ type: Number })
  amount_in: number;

  @Prop({ type: Number })
  amount_out: number;

  @Prop({ type: String })
  coin_in: string;

  @Prop({ type: String })
  coin_out: string;

  @Prop({ type: String })
  pool: string;

  @Prop({ type: String })
  sender: string;

  @Prop({ type: String, unique: true })
  hash: string;

  @Prop({ type: Number })
  timestampMs: number;
}

export const SwappedSchema = SchemaFactory.createForClass(Swapped);

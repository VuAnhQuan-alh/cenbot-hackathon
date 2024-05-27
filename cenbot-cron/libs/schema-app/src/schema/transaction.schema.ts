import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MSchema } from 'mongoose';
import { TransactionType } from '../types/enum';

export type TransactionsDocs = HydratedDocument<Transactions>;

@Schema({ timestamps: true, collection: 'transactions' })
export class Transactions {
  @Prop({ type: String, default: null })
  from: string;

  @Prop({ type: String, default: null })
  to: string;

  @Prop({ type: String, required: true })
  type: TransactionType;

  @Prop({ default: null })
  hash: string;

  @Prop()
  tokenType: string;

  @Prop()
  tokenAmount: number;

  @Prop()
  tokenPrice: number;

  @Prop({ type: String, required: true })
  status: string;

  @Prop({ type: MSchema.Types.Mixed })
  params: any;

  @Prop({ default: false, type: Boolean })
  scan: boolean;
}

export const TransactionsSchema = SchemaFactory.createForClass(Transactions);

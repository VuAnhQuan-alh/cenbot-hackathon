import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Type } from 'class-transformer';
import { Users } from './users.schema';

export type WalletsDocs = HydratedDocument<Wallets>;

@Schema({ timestamps: true, collection: 'wallets' })
export class Wallets {
  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  privateKey: string;

  @Prop({ type: Types.ObjectId, ref: Users.name })
  @Type(() => Users)
  ownerId: Users;

  @Prop({ default: false })
  main: boolean;
}

export const WalletsSchema = SchemaFactory.createForClass(Wallets);

export class NWallets extends Wallets {
  balance: string;
}

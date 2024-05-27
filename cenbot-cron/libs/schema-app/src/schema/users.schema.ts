import { HydratedDocument } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UsersDocs = HydratedDocument<Users>;

@Schema({ timestamps: true, collection: 'users' })
export class Users {
  @Prop()
  username: string;

  @Prop({ required: true })
  botId: number;

  @Prop({ default: 0 })
  point: number;

  @Prop({ default: null })
  xId: string;

  @Prop({ default: null })
  xUsername: string;

  @Prop({ default: null })
  xAvatar: string;

  @Prop({ type: Boolean, default: false })
  verify: boolean;

  @Prop({ default: null })
  code: string;

  @Prop({ default: null })
  referrer: string;
}

export const UsersSchema = SchemaFactory.createForClass(Users);

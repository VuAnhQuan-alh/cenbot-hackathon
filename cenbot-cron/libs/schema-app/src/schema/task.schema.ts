import { HydratedDocument, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { TypeDailyTasks } from '../types/enum';
import { Users } from './users.schema';

export type TasksDocs = HydratedDocument<Tasks>;

@Schema({ timestamps: true, collection: 'tasks' })
export class Tasks {
  @Prop({ required: true, type: Types.ObjectId, ref: Users.name })
  userId: Users;

  @Prop({ default: false, type: Boolean })
  following: boolean;

  @Prop({ default: false, type: Boolean })
  tweet: boolean;

  @Prop({ default: [] })
  tweetId: string[];

  @Prop({ default: false, type: Boolean })
  introduction_retweet: boolean;

  @Prop({ default: false, type: Boolean })
  introduction_like: boolean;

  @Prop({ default: [] })
  daily: TypeDailyTasks[];

  @Prop({ type: Number, default: 0 })
  transfer: number;

  @Prop({ type: Number, default: 0 })
  swap: number;

  @Prop({ type: Boolean, default: false })
  partnership_like: boolean;

  @Prop({ type: Boolean, default: false })
  partnership_retweet: boolean;

  @Prop({ type: Boolean, default: false })
  censpecial_like: boolean;

  @Prop({ type: Boolean, default: false })
  censpecial_retweet: boolean;

  @Prop({ type: Boolean, default: false })
  iscen_like: boolean;

  @Prop({ type: Boolean, default: false })
  iscen_retweet: boolean;

  @Prop({ type: Boolean, default: false })
  mission_like: boolean;

  @Prop({ type: Boolean, default: false })
  mission_retweet: boolean;

  @Prop({ type: Boolean, default: false })
  vision_like: boolean;

  @Prop({ type: Boolean, default: false })
  vision_retweet: boolean;

  @Prop({ type: Boolean, default: false })
  bounty_like: boolean;

  @Prop({ type: Boolean, default: false })
  bounty_retweet: boolean;
}

export const TasksSchema = SchemaFactory.createForClass(Tasks);

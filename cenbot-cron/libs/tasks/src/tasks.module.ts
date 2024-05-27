import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tasks, TasksSchema } from '@schema/schema-app/schema/task.schema';

import { TasksService } from './tasks.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tasks.name, schema: TasksSchema }]),
  ],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

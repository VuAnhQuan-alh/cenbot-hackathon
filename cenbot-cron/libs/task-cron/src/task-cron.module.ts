import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { TaskCronService } from './task-cron.service';

@Module({
  imports: [HttpModule],
  providers: [TaskCronService],
  exports: [TaskCronService],
})
export class TaskCronModule {}

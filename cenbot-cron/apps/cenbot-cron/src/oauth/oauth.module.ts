import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { UsersModule } from '@user-core/users';

import { OauthController } from './oauth.controller';
import { OauthService } from './oauth.service';
import { TaskCronModule } from '@task-cron/task-cron';

@Module({
  imports: [HttpModule, UsersModule, TaskCronModule],
  controllers: [OauthController],
  providers: [OauthService],
})
export class OauthModule {}

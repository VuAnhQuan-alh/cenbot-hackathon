import { FilterQuery } from 'mongoose';

import { Body, Controller, Delete, Get } from '@nestjs/common';
import { Snipers } from '@schema/schema-app/schema/sniper.schema';

import { CronjobService } from './cronjob.service';
import { SnipersQueryEvent } from './snipe-query-event.service';

@Controller()
export class CronjobController {
  constructor(
    private readonly cronjobService: CronjobService,
    private readonly snipeQuery: SnipersQueryEvent,
  ) {}

  @Get()
  async getHello() {
    return this.cronjobService.getHello();
    // return await this.snipeQuery.handleSnipeCronjob();
  }

  @Get('snipe')
  async getSnipe(@Body() body: { query: FilterQuery<Snipers> }) {
    const data = await this.snipeQuery.getAllQuerySnipe(body.query);
    return { data, message: 'Get all snipe swap false' };
  }

  @Delete('snipe-remove')
  async removeSnipe(@Body() body: { ids: string[] }) {
    const data = await this.snipeQuery.removeAllQuerySnipe(body.ids);
    return { data, message: 'Delete all snipes' };
  }

  @Get('daily')
  async runCronjobDaily() {
    return await this.cronjobService.handleDailyTask();
  }

  @Get('social')
  async runCronjobSocial() {
    return await this.cronjobService.handleSocialTask();
  }
}

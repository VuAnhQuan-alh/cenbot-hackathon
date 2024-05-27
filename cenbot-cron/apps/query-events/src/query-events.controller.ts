import { Controller, Get } from '@nestjs/common';

import { QueryEventsService } from './query-events.service';

@Controller()
export class QueryEventsController {
  constructor(private readonly queryEventsService: QueryEventsService) {}

  @Get()
  getHello(): { message: string } {
    return this.queryEventsService.getHello();
  }

  // @Get('snipe-token')
  // async getTokenSnipe() {
  //   return await this.queryEventsService.handleSwappedToken();
  // }

  @Get('liquidity-turbos')
  async getLiquidityTurbos() {
    return await this.queryEventsService.getTurbosLiquidity();
  }

  @Get('liquidity-flowx')
  async getLiquidityFlowX() {
    return await this.queryEventsService.getFlowXLiquidity();
  }
  @Get('liquidity-cetus')
  async getLiquidityCetus() {
    return await this.queryEventsService.getCetusLiquidity();
  }
  @Get('swap-turbos')
  async getSwapTurbos() {
    return await this.queryEventsService.getTurbosSwap();
  }
  @Get('swap-flowx')
  async getSwapFlowX() {
    return await this.queryEventsService.getFlowXSwap();
  }
  @Get('swap-cetus')
  async getSwapCetus() {
    return await this.queryEventsService.getCetusSwap();
  }
}

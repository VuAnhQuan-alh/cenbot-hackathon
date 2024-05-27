import { Aftermath } from 'aftermath-ts-sdk';
import {
  LiquidityEvent,
  ParsedSuiEvent,
  SwapEvent,
} from 'apps/cenbot-cron/src/bots/types/type.snipe';
import { provider } from 'apps/cenbot-cron/src/configs/provider';
import BigNumber from 'bignumber.js';

import { SuiEvent, SuiEventFilter } from '@mysten/sui.js/dist/cjs/client';
import { HttpService } from '@nestjs/axios';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LiquiditiesService } from '@user-sniper/snipers/liquidities.service';
import { SwappedService } from '@user-sniper/snipers/swapped.service';

interface ConvertSuiEvent
  extends Omit<SuiEvent, 'parsedJson'>,
    ParsedSuiEvent {}

@Injectable()
export class QueryEventsService implements OnModuleInit {
  private readonly logger = new Logger(QueryEventsService.name);

  constructor(
    private readonly swap: SwappedService,
    private readonly liquidity: LiquiditiesService,
    private readonly config: ConfigService,
    private readonly http: HttpService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  getHello(): { message: string } {
    return { message: 'Hello Query Events!' };
  }

  async onModuleInit() {
    this.logger.log('Snipers Query Event Initial!');

    await this.getTurbosLiquidity(1000);
    await this.getFlowXLiquidity(1000);
    await this.getCetusLiquidity(1000);

    await this.getTurbosSwap(1000);
    await this.getFlowXSwap(1000);
    await this.getCetusSwap(1000);

    await this.handleUpdatePrice();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleUpdatePrice() {
    const price = await this.getTokenPrice('sui');

    if (price?.price?.sui?.usd) {
      await this.cacheManager.set('sui-price', price.price.sui.usd);
    }
  }

  async getTokenPrice(ids: string) {
    try {
      const data = await this.http.axiosRef(
        this.config.getOrThrow<string>('API_COIN_PRICE'),
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.75 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
          },
          params: { ids, vs_currencies: 'usd' },
        },
      );
      const result = { price: data.data };
      return result;
    } catch (error) {
      console.log('error token price =>', error.message);
    }
  }

  @Cron('*/1 * * * * *')
  async handleTurbosLiquidity() {
    await this.getTurbosLiquidity();
  }

  @Cron('*/1 * * * * *')
  async handleFlowXLiquidity() {
    await this.getFlowXLiquidity();
  }

  @Cron('*/1 * * * * *')
  async handleTurbosSwap() {
    await this.getTurbosSwap();
  }

  @Cron('*/1 * * * * *')
  async handleFlowXSwap() {
    await this.getFlowXSwap();
  }

  @Cron('*/1 * * * * *')
  async handleCetusLiquidity() {
    await this.getCetusLiquidity();
  }

  @Cron('*/1 * * * * *')
  async handleCetusSwap() {
    await this.getCetusSwap();
  }

  async createSwapped(data: SwapEvent) {
    try {
      return await this.swap
        .create({
          ...data,
          amount_in: +data.amount_in,
          amount_out: +data.amount_out,
          timestampMs: +data.timestampMs,
        })
        .then(() => true)
        .catch(() => false);
    } catch (error) {
      return false;
    }
  }

  async insertSwapped(data: SwapEvent[]) {
    try {
      return (
        await Promise.all(
          data.map(async (item) => {
            return await this.createSwapped(item);
          }),
        )
      ).filter((item) => item).length;
      // return await this.swap.insertMany(
      //   data.map((item) => ({
      //     ...item,
      //     amount_in: +item.amount_in,
      //     amount_out: +item.amount_out,
      //     timestampMs: +item.timestampMs,
      //   })),
      // );
    } catch (error) {
      return false;
    }
  }

  async createLiquidity(data: LiquidityEvent) {
    try {
      // const isCheckFirst = async (coin_x: string) =>
      //   await this.liquidity.findAll({
      //     coin_x,
      //   });
      // const isFirst = (await isCheckFirst(data.coin_x)).length > 0;

      return await this.liquidity
        .create({
          ...data,
          amount_x: +data.amount_x,
          amount_y: +data.amount_y,
          timestampMs: +data.timestampMs,
          isFirst: false,
        })
        .then(() => true)
        .catch(() => false);
    } catch (error) {
      return false;
    }
  }

  async insertLiquidity(data: LiquidityEvent[]) {
    try {
      return (
        await Promise.all(
          data.map(async (item) => {
            return await this.createLiquidity(item);
          }),
        )
      ).filter((item) => item).length;
      // return await this.liquidity.insertMany(
      //   data.map((item) => ({
      //     ...item,
      //     amount_x: +item.amount_x,
      //     amount_y: +item.amount_y,
      //     timestampMs: +item.timestampMs,
      //     isFirst: false,
      //   })),
      // );
    } catch (error) {
      return false;
    }
  }

  async checkIsExactlyHash(
    collection: string,
    listHash: string[],
  ): Promise<boolean> {
    if (collection === 'swap') {
      return (
        (
          await this.swap.findAll({
            $or: listHash.map((hash) => ({ hash })),
          })
        ).length > 0
      );
    } else if (collection === 'liquidity') {
      return (
        (
          await this.liquidity.findAll({
            $or: listHash.map((hash) => ({ hash })),
          })
        ).length > 0
      );
    } else {
      return false;
    }
  }

  async queryEventsInternal({
    data,
    query,
    cursor,
    hasNextPage,
    collection,
    dex,
    isProvider,
    limit = 25,
  }: {
    data: Array<SuiEvent | LiquidityEvent | SwapEvent>;
    query: SuiEventFilter;
    cursor: {
      txDigest: string;
      eventSeq: string;
    } | null;
    hasNextPage: boolean;
    collection: string;
    dex: string;
    isProvider: boolean;
    limit?: number;
  }): Promise<Array<SuiEvent | LiquidityEvent | SwapEvent>> {
    try {
      if (!hasNextPage) return data;

      const payload = await provider.queryEvents({
        query,
        cursor,
        limit,
      });
      let payloadData = [];

      if (isProvider) {
        if (collection === 'liquidity' && dex === 'cetus') {
          payloadData = (
            await Promise.all(
              payload.data.map(async (event: ConvertSuiEvent) => {
                const pool = await provider.getObject({
                  id: event.parsedJson.pool,
                  options: { showType: true },
                });
                const types = pool.data.type.split('<')[1].split(',');
                return {
                  name: 'Cetus',
                  type: 'liquidity',
                  coin_x: types[0],
                  coin_y: types[1].slice(1, types[1].length - 1),
                  amount_x: event.parsedJson.amount_a,
                  amount_y: event.parsedJson.amount_b,
                  pool: event.parsedJson.pool,
                  sender: event.sender,
                  hash: event.id.txDigest,
                  timestampMs: event.timestampMs,
                };
              }),
            )
          ).filter(
            (event) =>
              event.coin_x === '0x2::sui::SUI' ||
              event.coin_y === '0x2::sui::SUI' ||
              event.coin_x ===
                '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN' ||
              event.coin_y ===
                '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
          );
        } else if (collection === 'liquidity' && dex === 'turbos') {
          payloadData = (
            await Promise.all(
              payload.data.map(async (event: ConvertSuiEvent) => {
                const pool = await provider.getObject({
                  id: event.parsedJson.pool,
                  options: { showType: true },
                });
                const types = pool.data.type.split('<')[1].split(',');
                return {
                  name: 'Turbos',
                  type: 'liquidity',
                  coin_x: types[0],
                  coin_y: types[1].slice(1),
                  amount_x: event.parsedJson.amount_a,
                  amount_y: event.parsedJson.amount_b,
                  pool: event.parsedJson.pool,
                  sender: event.sender,
                  hash: event.id.txDigest,
                  timestampMs: event.timestampMs,
                };
              }),
            )
          ).filter(
            (event) =>
              event.coin_x === '0x2::sui::SUI' ||
              event.coin_y === '0x2::sui::SUI' ||
              event.coin_x ===
                '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN' ||
              event.coin_y ===
                '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
          );
        } else if (collection === 'swap' && dex === 'cetus') {
          payloadData = await Promise.all(
            payload.data.map(async (event: ConvertSuiEvent) => {
              const pool = await provider.getObject({
                id: event.parsedJson.pool,
                options: { showType: true },
              });
              const types = pool.data.type.split('<')[1].split(',');
              return {
                name: 'Cetus',
                type: 'swap',
                amount_in: event.parsedJson.amount_in,
                amount_out: event.parsedJson.amount_out,
                coin_in: event.parsedJson.atob
                  ? types[0]
                  : types[1].slice(1, types[1].length - 1),
                coin_out: event.parsedJson.atob
                  ? types[1].slice(1, types[1].length - 1)
                  : types[0],
                pool: event.parsedJson.pool,
                sender: event.sender,
                hash: event.id.txDigest,
                timestampMs: event.timestampMs,
              };
            }),
          );
        } else if (collection === 'swap' && dex === 'turbos') {
          payloadData = await Promise.all(
            payload.data.map(async (event: ConvertSuiEvent) => {
              const pool = await provider.getObject({
                id: event.parsedJson.pool,
                options: { showType: true },
              });
              const types = pool.data.type.split('<')[1].split(',');
              return {
                name: 'Turbos',
                type: 'swap',
                amount_in: event.parsedJson.a_to_b
                  ? event.parsedJson.amount_a
                  : event.parsedJson.amount_b,

                amount_out: event.parsedJson.a_to_b
                  ? event.parsedJson.amount_b
                  : event.parsedJson.amount_a,

                coin_in: event.parsedJson.a_to_b ? types[0] : types[1].slice(1),

                coin_out: event.parsedJson.a_to_b
                  ? types[1].slice(1)
                  : types[0],
                pool: event.parsedJson.pool,
                sender: event.sender,
                hash: event.id.txDigest,
                timestampMs: event.timestampMs,
              };
            }),
          );
        }
      } else {
        payloadData = payload.data;
      }

      if (dex === 'flowx' && collection === 'swap') {
        const eventsData: SwapEvent[] = payloadData.map(
          (event: ConvertSuiEvent) => {
            return {
              name: 'FlowX',
              type: 'swap',
              amount_in: new BigNumber(event.parsedJson.amount_x_in).gt(0)
                ? event.parsedJson.amount_x_in
                : event.parsedJson.amount_y_in,

              amount_out: new BigNumber(event.parsedJson.amount_x_out).gt(0)
                ? event.parsedJson.amount_x_out
                : event.parsedJson.amount_y_out,
              coin_in: new BigNumber(event.parsedJson.amount_x_in).gt(0)
                ? event.parsedJson.coin_x
                : event.parsedJson.coin_y,
              coin_out: new BigNumber(event.parsedJson.amount_x_out).gt(0)
                ? event.parsedJson.coin_x
                : event.parsedJson.coin_y,
              pool: event.parsedJson.pool,
              sender: event.sender,
              hash: event.id.txDigest,
              timestampMs: event.timestampMs,
            };
          },
        );
        const swapped = await this.insertSwapped(eventsData);
        console.log({ dex, collection, count: swapped });
      } else if (dex === 'flowx' && collection === 'liquidity') {
        const eventsData: LiquidityEvent[] = payloadData
          .filter(
            (event: ConvertSuiEvent) =>
              event.parsedJson.coin_x ===
                '0000000000000000000000000000000000000000000000000000000000000002::sui::SUI' ||
              event.parsedJson.coin_y ===
                '0000000000000000000000000000000000000000000000000000000000000002::sui::SUI' ||
              event.parsedJson.coin_x ===
                '5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN' ||
              event.parsedJson.coin_y ===
                '5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
          )
          .map((event: ConvertSuiEvent) => {
            return {
              name: 'FlowX',
              type: 'liquidity',
              coin_x: event.parsedJson.coin_x,
              coin_y: event.parsedJson.coin_y,
              amount_x: event.parsedJson.amount_x,
              amount_y: event.parsedJson.amount_y,
              sender: event.sender,
              pool: event.parsedJson.pool,
              hash: event.id.txDigest,
              timestampMs: event.timestampMs,
            };
          });
        const liquidity = await this.insertLiquidity(eventsData);
        console.log({ dex, collection, count: liquidity });
      } else if (dex !== 'flowx' && collection === 'swap') {
        const swapped = await this.insertSwapped(payloadData);
        console.log({ dex, collection, count: swapped });
      } else if (dex !== 'flowx' && collection === 'liquidity') {
        const liquidity = await this.insertLiquidity(payloadData);
        console.log({ dex, collection, count: liquidity });
      }

      const isExactly = await this.checkIsExactlyHash(
        collection,
        payloadData.map((item) => item?.id?.txDigest || item.hash),
      );

      // TO DO: thêm điều kiện dừng (trùng hash đã save)
      const isContinue = payload.hasNextPage && !isExactly;

      return await this.queryEventsInternal({
        query,
        cursor: payload.nextCursor,
        hasNextPage: isContinue,
        data: [],
        collection,
        dex,
        isProvider,
        limit,
      });
    } catch (error) {
      console.log('error query internal:', error.message);
      return data;
    }
  }

  // get flowX swap
  async getFlowXSwap(limit?: number) {
    const query = {
      MoveEventType:
        '0xba153169476e8c3114962261d1edc70de5ad9781b83cc617ecc8c1923191cae0::pair::Swapped',
    };

    await this.queryEventsInternal({
      query,
      cursor: null,
      data: [],
      hasNextPage: true,
      collection: 'swap',
      dex: 'flowx',
      isProvider: false,
      limit,
    });
    console.log('Done Query FlowX Swap!');
  }
  // get flowX liquidity
  async getFlowXLiquidity(limit?: number) {
    try {
      const query = {
        MoveEventType:
          '0xba153169476e8c3114962261d1edc70de5ad9781b83cc617ecc8c1923191cae0::pair::LiquidityAdded',
      };
      await this.queryEventsInternal({
        query,
        cursor: null,
        data: [],
        hasNextPage: true,
        collection: 'liquidity',
        dex: 'flowx',
        isProvider: false,
        limit,
      });
      console.log('Done Query FlowX Liquidity!');
    } catch (error) {
      console.log('error query flow x liq:', error.message);
    }
  }

  // get cetus swap
  async getCetusSwap(limit?: number) {
    const query = {
      MoveEventType:
        '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::SwapEvent',
    };
    await this.queryEventsInternal({
      query,
      cursor: null,
      data: [],
      hasNextPage: true,
      collection: 'swap',
      dex: 'cetus',
      isProvider: true,
      limit,
    });

    console.log('Done Query Cetus Swap!');
  }
  // get cetus liquidity
  async getCetusLiquidity(limit?: number) {
    try {
      const query = {
        MoveEventType:
          '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::AddLiquidityEvent',
      };
      await this.queryEventsInternal({
        query,
        cursor: null,
        data: [],
        hasNextPage: true,
        collection: 'liquidity',
        dex: 'cetus',
        isProvider: true,
        limit,
      });

      console.log('Done Query Cetus Liquidity!');
    } catch (error) {
      console.log('error query cetus liq:', error.message);
    }
  }

  // get turbos swap
  async getTurbosSwap(limit?: number) {
    const query = {
      MoveEventType:
        '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::pool::SwapEvent',
    };
    await this.queryEventsInternal({
      query,
      cursor: null,
      data: [],
      hasNextPage: true,
      collection: 'swap',
      dex: 'turbos',
      isProvider: true,
      limit,
    });

    console.log('Done Query Turbos Swap!');
  }
  // get turbos liquidity
  async getTurbosLiquidity(limit?: number) {
    try {
      const query = {
        MoveEventType:
          '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::pool::MintEvent',
      };
      await this.queryEventsInternal({
        query,
        cursor: null,
        data: [],
        hasNextPage: true,
        collection: 'liquidity',
        dex: 'turbos',
        isProvider: true,
        limit,
      });

      console.log('Done Query Turbos Liquidity!');
    } catch (error) {
      console.log('error query turbos liq:', error.message);
    }
  }

  // Swap
  async swapToken(
    coinOutType: string,
    coinInAmount: string,
    wallet: string,
    slippage?: number,
  ) {
    const router = new Aftermath('MAINNET').Router();

    // console.log({ coinInAmount, coinOutType, wallet });
    const route = await router.getCompleteTradeRouteGivenAmountIn({
      coinInType: '0x2::sui::SUI',
      coinOutType,
      coinInAmount: BigInt(coinInAmount),
    });

    const tx = await router.getTransactionForCompleteTradeRoute({
      walletAddress: wallet,
      completeRoute: route,
      slippage: slippage ?? 0.2,
    });

    const gasPrice = await provider.getReferenceGasPrice();
    tx.setGasPrice(
      new BigNumber(gasPrice.toString()).multipliedBy(2).toNumber(),
    );
    tx.setGasBudget(1_000_000_000);

    return tx;
  }
}

import { provider } from 'apps/cenbot-cron/src/configs/provider';
import { getBalanceMeta, getPriceSui } from 'apps/cenbot-cron/src/utils/trade';
import BigNumber from 'bignumber.js';
import { FilterQuery } from 'mongoose';

import { DexSdkService } from '@dex-sdk/dex-sdk';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/dist/cjs/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { HttpService } from '@nestjs/axios';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Snipers } from '@schema/schema-app/schema/sniper.schema';
import { WalletsService } from '@user-address/address';
import { UsersService } from '@user-core/users';
import { SnipersService } from '@user-sniper/snipers';
import { LiquiditiesService } from '@user-sniper/snipers/liquidities.service';
import { SwappedService } from '@user-sniper/snipers/swapped.service';

@Injectable()
export class SnipersQueryEvent {
  private readonly logger = new Logger(SnipersQueryEvent.name);

  constructor(
    private readonly swap: SwappedService,
    private readonly liquidity: LiquiditiesService,
    private readonly snipe: SnipersService,
    private readonly dexSdk: DexSdkService,
    private readonly users: UsersService,
    private readonly wallet: WalletsService,
    private readonly config: ConfigService,
    private readonly http: HttpService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Cron('*/3 * * * * *')
  async handleSnipeCronjob() {
    if (this.config.getOrThrow<string>('NODE_ENV') === 'development') return;

    try {
      const BE_URI = this.config.getOrThrow('BE_URL');
      const listSnipe = await this.snipe.findAll({
        swapped: false,
        autoSell: 'OFF',
        noSwap: false,
      });
      const suiPrice = await this.cacheManager.get('sui-price');

      return await Promise.all(
        listSnipe
          .filter((item) => item.maxSpend && Number(item.maxSpend) > 0)
          .map(async (snipe) => {
            const isExactLiq = await this.liquidity.getLiquidity({
              $or: [
                { coin_x: { $in: [snipe.token, snipe.token.slice(2)] } },
                { coin_y: { $in: [snipe.token, snipe.token.slice(2)] } },
              ],
            });

            const isExactSwap = await this.swap.count({
              $or: [{ coin_in: snipe.token }, { coin_out: snipe.token }],
            });

            if (
              isExactLiq &&
              ((isExactSwap <= 10 && snipe.firstOfFail) || !snipe.firstOfFail)
            ) {
              this.logger.log('Swap token for snipe!');

              console.log({ isExactLiq, botId: snipe.userId.botId });
              await this.snipe.update(
                { _id: snipe._id },
                { swapped: true, pool: isExactLiq.pool },
              );
              const type = await getBalanceMeta(snipe.token);
              const gasPrice = await provider.getReferenceGasPrice();

              try {
                await Promise.all(
                  snipe.wallets.map(async (wallet) => {
                    let txb: TransactionBlock;
                    // let firstPrice: number = 0;
                    let amount_out: number = 0;
                    const firstLiq = isExactLiq;
                    const amount = (
                      +snipe.maxSpend * Math.pow(10, 9)
                    ).toString();
                    const tokenPrice =
                      (firstLiq.amount_y / firstLiq.amount_x) * +suiPrice;

                    console.log({
                      type: {
                        decimals: type.decimals,
                        name: type.name,
                        symbol: type.symbol,
                      },
                      wallet: snipe.wallets,
                      token: snipe.token,
                      maxSpend: snipe.maxSpend,
                      botId: snipe.userId.botId,
                    });
                    // return;

                    if (firstLiq.name === 'Cetus') {
                      const {
                        payload,
                        // price,
                        amount: amountOut,
                      } = await this.dexSdk.swapCetus(
                        wallet,
                        firstLiq.pool,
                        amount,
                        +suiPrice,
                      );
                      txb = payload;
                      // firstPrice = +price;
                      amount_out = +amountOut;
                    } else if (firstLiq.name === 'Turbos') {
                      const {
                        payload,
                        // price,
                        amount: amountOut,
                      } = await this.dexSdk.swapTurbos(
                        wallet,
                        firstLiq.pool,
                        amount,
                        +suiPrice,
                      );
                      txb = payload;
                      // firstPrice = +price;
                      amount_out = +amountOut;
                    } else if (firstLiq.name === 'FlowX') {
                      const {
                        payload,
                        // price,
                        amount: amountOut,
                      } = await this.dexSdk.swapFlowX(
                        wallet,
                        {
                          type: snipe.token,
                          symbol: type.symbol,
                          decimals: type.decimals,
                        },
                        amount,
                        +suiPrice,
                        type.decimals,
                      );
                      // @ts-ignore
                      txb = payload;
                      // firstPrice = +price;
                      amount_out = +amountOut;
                    }

                    txb.setGasPrice(
                      new BigNumber(gasPrice.toString())
                        .multipliedBy(2)
                        .toNumber(),
                    );

                    try {
                      const secretKey = (
                        await this.wallet.getWal({ address: wallet })
                      ).privateKey;
                      const privateKey = decodeSuiPrivateKey(secretKey);
                      const keypair = Ed25519Keypair.fromSecretKey(
                        privateKey.secretKey,
                      );

                      const txn = await provider.signAndExecuteTransactionBlock(
                        {
                          signer: keypair,
                          transactionBlock: txb,
                          options: { showEffects: true },
                        },
                      );
                      console.log('trans-swap:', {
                        ...txn,
                        botId: snipe.userId.botId,
                        price: tokenPrice,
                      });

                      if (txn.effects.status.status === 'success') {
                        await this.snipe.update(
                          { _id: snipe._id },
                          {
                            swapDex: firstLiq.name,
                            hash: txn.digest,
                            firstPrice: tokenPrice,
                          },
                        );
                        const uri = `${BE_URI}/bot/snipe-pnl/${snipe.userId.botId}/${snipe._id}/${amount_out}`;
                        this.http.axiosRef.get(uri);
                      } else {
                        await this.snipe.update(
                          { _id: snipe._id },
                          { swapped: false },
                        );
                      }
                      return {
                        status: txn.effects.status.status,
                        hash: txn.digest,
                      };
                    } catch (error) {
                      // await this.snipe.update(
                      //   { _id: snipe._id },
                      //   { swapped: false },
                      // );
                      console.log('send transaction error:', error.message);
                    }
                  }),
                );
              } catch (error) {
                await this.snipe.update({ _id: snipe._id }, { noSwap: true });
                console.log('throw error snipe token:', error.message);
              }
            }
          }),
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Cron('*/30 * * * * *')
  async handleAntiRugCronjob() {
    try {
      const date = new Date();
      date.setMinutes(date.getMinutes() - 1);
      // date.setHours(date.getHours() - 1);

      const BE_URI = this.config.getOrThrow('BE_URL');
      const suiPrice = await this.cacheManager.get('sui-price');

      const listSnipe = await this.snipe.findAll({
        antiRug: true,
        swapped: false,
        noSwap: false,
      });
      if (listSnipe.length === 0) return;

      await Promise.all(
        listSnipe.map(async (snipe) => {
          const listSwap = (
            await this.swap.findAll({
              $or: [{ coin_in: { $in: [snipe.token, snipe.token.slice(2)] } }],
              timestampMs: { $gt: date.getTime() },
            })
          ).sort((a, b) => b.amount_in - a.amount_in);

          if (listSwap.length === 0) return;

          this.logger.log('Check anti rug for snipe!');
          const maxSwap = listSwap[0];

          const price = await getPriceSui(
            maxSwap.coin_in,
            maxSwap.amount_in.toString(),
            +suiPrice,
          );
          console.log({ 'anti-rug': price, hash: maxSwap.hash });

          if (+price > 5000) {
            const uri = `${BE_URI}/bot/snipe-antirug/${snipe.token}`;
            this.http.axiosRef.get(uri);
          }
          return;
        }),
      );
    } catch (error) {
      console.log('error cronjob anti rug', error.message);

      throw new BadRequestException(error.message);
    }
  }

  @Cron('*/5 * * * * *')
  async handleCheckAutoSell() {
    if (this.config.getOrThrow<string>('NODE_ENV') === 'development') return;

    try {
      const suiPrice = await this.cacheManager.get('sui-price');
      const listSnipe = await this.snipe.findAll({
        swapped: false,
        autoSell: { $ne: 'OFF' },
        pool: '',
        noSwap: false,
      });

      return await Promise.all(
        listSnipe
          .filter((item) => item.autoSell)
          .map(async (snipe) => {
            if (!snipe.autoSell.includes('%')) return;
            const isExactLiq = await this.liquidity.getLiquidity({
              $or: [
                { coin_x: { $in: [snipe.token, snipe.token.slice(2)] } },
                { coin_y: { $in: [snipe.token, snipe.token.slice(2)] } },
              ],
            });

            const isExactSwap = await this.swap.count({
              $or: [{ coin_in: snipe.token }, { coin_out: snipe.token }],
            });

            if (
              isExactLiq &&
              ((isExactSwap <= 10 && snipe.firstOfFail) || !snipe.firstOfFail)
            ) {
              console.log({ isExactLiq, botId: snipe.userId.botId });

              const type = await getBalanceMeta(snipe.token);
              await Promise.all(
                snipe.wallets.map(async (wallet) => {
                  let priceToken: number = 0;
                  const firstLiq = isExactLiq;
                  const amount = (+snipe.maxSpend * Math.pow(10, 9)).toString();

                  if (firstLiq.name === 'Cetus') {
                    const { price } = await this.dexSdk.swapCetus(
                      wallet,
                      firstLiq.pool,
                      amount,
                      +suiPrice,
                    );
                    priceToken = +price;
                  } else if (firstLiq.name === 'Turbos') {
                    const { price } = await this.dexSdk.swapTurbos(
                      wallet,
                      firstLiq.pool,
                      amount,
                      +suiPrice,
                    );
                    priceToken = +price;
                  } else if (firstLiq.name === 'FlowX') {
                    const { price } = await this.dexSdk.swapFlowX(
                      wallet,
                      {
                        type: snipe.token,
                        symbol: type.symbol,
                        decimals: type.decimals,
                      },
                      amount,
                      +suiPrice,
                      type.decimals,
                    );
                    priceToken = +price;
                  }

                  this.logger.log('Check auto sell for snipe!');
                  await this.snipe.update(
                    { _id: snipe._id },
                    {
                      swapDex: firstLiq.name,
                      pool: isExactLiq.pool,
                      lastPrice: priceToken,
                    },
                  );
                  return;
                }),
              );
            }
            return;
          }),
      );
    } catch (error) {
      console.log('error check auto sell:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  @Cron('*/3 * * * * *')
  async handleAutoSellCronjob() {
    try {
      if (this.config.getOrThrow<string>('NODE_ENV') === 'development') return;

      const BE_URI = this.config.getOrThrow('BE_URL');
      const suiPrice = await this.cacheManager.get('sui-price');

      const listSnipe = await this.snipe.findAll({
        swapped: false,
        autoSell: { $ne: 'OFF' },
        pool: { $ne: '' },
        noSwap: false,
      });

      await Promise.all(
        listSnipe
          .filter((item) => item.autoSell)
          .map(async (snipe) => {
            if (!snipe.autoSell.includes('%')) return;

            this.logger.log('Swap token for auto snipe!');
            await this.snipe.update({ _id: snipe._id }, { swapped: true });

            const type = await getBalanceMeta(snipe.token);
            const percent = +snipe.autoSell?.split('%')[0] / 100;
            console.log({ 'auto-sell': snipe, percent });

            await Promise.all(
              snipe.wallets.map(async (wallet) => {
                let txb: TransactionBlock;
                let priceToken: number = 0;
                let amount_out: number = 0;
                const amount = (+snipe.maxSpend * Math.pow(10, 9)).toString();

                if (snipe.swapDex === 'Cetus') {
                  const {
                    price,
                    payload,
                    amount: amountOut,
                  } = await this.dexSdk.swapCetus(
                    wallet,
                    snipe.pool,
                    amount,
                    +suiPrice,
                  );
                  priceToken = +price;
                  txb = payload;
                  amount_out = +amountOut;
                } else if (snipe.swapDex === 'Turbos') {
                  const {
                    price,
                    payload,
                    amount: amountOut,
                  } = await this.dexSdk.swapTurbos(
                    wallet,
                    snipe.pool,
                    amount,
                    +suiPrice,
                  );
                  priceToken = +price;
                  txb = payload;
                  amount_out = +amountOut;
                } else if (snipe.swapDex === 'FlowX') {
                  const {
                    price,
                    payload,
                    amount: amountOut,
                  } = await this.dexSdk.swapFlowX(
                    wallet,
                    {
                      type: snipe.token,
                      symbol: type.symbol,
                      decimals: type.decimals,
                    },
                    amount,
                    +suiPrice,
                    type.decimals,
                  );
                  txb = payload;
                  priceToken = +price;
                  amount_out = +amountOut;
                }

                if (
                  (percent > 0 &&
                    priceToken < percent * snipe.lastPrice + snipe.lastPrice) ||
                  (percent < 0 &&
                    priceToken > percent * snipe.lastPrice + snipe.lastPrice)
                ) {
                  await this.snipe.update(
                    { _id: snipe._id },
                    { swapped: false },
                  );
                  return;
                }

                try {
                  const gasPrice = await provider.getReferenceGasPrice();
                  txb.setGasPrice(
                    new BigNumber(gasPrice.toString())
                      .multipliedBy(2)
                      .toNumber(),
                  );

                  const secretKey = (
                    await this.wallet.getWal({ address: wallet })
                  ).privateKey;
                  const privateKey = decodeSuiPrivateKey(secretKey);
                  const keypair = Ed25519Keypair.fromSecretKey(
                    privateKey.secretKey,
                  );

                  const swap_txn =
                    await provider.signAndExecuteTransactionBlock({
                      signer: keypair,
                      transactionBlock: txb,
                      options: { showEffects: true },
                    });

                  console.log('swap autosell: ', swap_txn);
                  console.log('price-token', priceToken);

                  if (swap_txn.effects.status.status === 'success') {
                    await this.snipe.update(
                      { _id: snipe._id },
                      {
                        hash: swap_txn.digest,
                        firstPrice: priceToken,
                      },
                    );
                    const uri = `${BE_URI}/bot/snipe-pnl/${snipe.userId.botId}/${snipe._id}/${amount_out}`;
                    this.http.axiosRef.get(uri);
                  } else {
                    await this.snipe.update(
                      { _id: snipe._id },
                      { swapped: false },
                    );
                  }

                  return {
                    status: swap_txn.effects.status.status,
                    hash: swap_txn.digest,
                  };
                } catch (error) {
                  console.log('auto sell transaction error:', error.message);
                }
              }),
            );
          }),
      );
    } catch (error) {
      console.log('error auto snipe:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  async getAllQuerySnipe(query: FilterQuery<Snipers>) {
    try {
      if (query.userId) {
        const { userId, ...options } = query;
        const user = await this.users.getOne(userId);

        return await this.snipe.findAll({ ...options, userId: user._id });
      }

      return await this.snipe.findAll(query);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async removeAllQuerySnipe(snipeIds: string[]) {
    try {
      return await this.snipe.removeMany(snipeIds);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}

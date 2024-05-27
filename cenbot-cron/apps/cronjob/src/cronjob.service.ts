import { formatPrice, router } from 'apps/cenbot-cron/src/configs/provider';
import { queryTransactions } from 'apps/cenbot-cron/src/utils/queryTransactions';
import BigNumber from 'bignumber.js';
import * as dayjs from 'dayjs';

import { SuiTransaction } from '@mysten/sui.js/dist/cjs/client';
import { HttpService } from '@nestjs/axios';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaskCronService } from '@task-cron/task-cron';
import { WalletsService } from '@user-address/address';
import { UsersService } from '@user-core/users';
import { TasksService } from '@user-task/tasks';

@Injectable()
export class CronjobService implements OnModuleInit {
  private readonly logger = new Logger(CronjobService.name);

  constructor(
    private readonly userService: UsersService,
    private readonly taskService: TasksService,
    private readonly taskCronjob: TaskCronService,
    private readonly walletService: WalletsService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit() {
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
      const data = await this.httpService.axiosRef(
        this.configService.getOrThrow<string>('API_COIN_PRICE'),
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

  getHello() {
    return { message: 'Hello Cronjob!' };
  }

  // @Cron(CronExpression.EVERY_5_MINUTES)
  async socialRunCronjob() {
    if (this.configService.getOrThrow<string>('NODE_ENV') === 'production') {
      const dataX = await this.taskCronjob.getUserDetail('1739957205485637633');
      if (dataX?.data) {
        this.logger.log('Social Task Cron!');
        this.handleSocialTask();
      }
    }
  }

  @Cron('*/20 * * * * *')
  dailyRunCronjob() {
    if (this.configService.getOrThrow<string>('NODE_ENV') === 'production') {
      this.handleDailyTask();
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  dailyRunDeposit() {
    if (this.configService.getOrThrow<string>('NODE_ENV') === 'production') {
      this.logger.log('Daily Deposit Cron!');
      const date = dayjs(new Date()).subtract(1, 'day').format('YYYY/MM/DD');
      this.handleDeposit(date);
    }
  }

  async handleDeposit(time: string) {
    try {
      const wallets = await this.walletService.getWallets({});

      const filterTxns = (txns: Array<SuiTransaction>) => {
        return (
          // @ts-ignore
          (txns.find((r) => !!r.TransferObjects) ||
            // @ts-ignore
            txns.find((r) => !!r.MoveCall)) &&
          // @ts-ignore
          !txns.find((r) => !!r.MergeCoins) &&
          // @ts-ignore
          !txns.find((r) => !!r.Publish) &&
          // @ts-ignore
          !txns.find((r) => !!r.Upgrade)
        );
      };

      const transDeposit = async (address: string, startTime?: number) => {
        const SUI_ADDRESS = address;
        const eventFilter = {
          filter: {
            ToAddress: SUI_ADDRESS,
          },
          options: {
            /** Whether to show balance_changes. Default to be False */
            showBalanceChanges: true,
            /** Whether to show transaction effects. Default to be False */
            // showEffects: true,
            /** Whether to show transaction events. Default to be False */
            // showEvents: true,
            /** Whether to show transaction input data. Default to be False */
            showInput: true,
            /** Whether to show object_changes. Default to be False */
            // showObjectChanges: true,
          },
        };
        const res = await queryTransactions({
          query: eventFilter,
          limit: 10000,
          startTime,
        });
        const suiPrice = (await this.getTokenPrice('sui'))?.price?.sui?.usd;

        const receipts = res
          .filter((r) =>
            filterTxns(
              (r.transaction?.data.transaction as any)
                .transactions as Array<SuiTransaction>,
            ),
          )
          .filter((r) =>
            r.balanceChanges?.find(
              (r) =>
                new BigNumber(r.amount).gt(0) &&
                // @ts-ignore
                r.owner.AddressOwner.toLowerCase() ===
                  SUI_ADDRESS.toLowerCase(),
            ),
          )
          .map((item) => ({
            digest: item.digest,
            timestampMs: item.timestampMs,
            checkpoint: item.checkpoint,
            balance: item.balanceChanges.find(
              // @ts-ignore
              (bal) => bal.amount > 0 && bal.owner.AddressOwner === address,
            ),
          }));

        const changeReceipts = receipts.map(async (rec) => {
          const route = await router.getCompleteTradeRouteGivenAmountIn({
            coinInType: rec.balance.coinType,
            coinOutType: '0x2::sui::SUI',
            coinInAmount: BigInt(+rec.balance.amount),
          });
          const priceOnSui = 1 / route.spotPrice;
          const priceOnUSD = +priceOnSui * +suiPrice;

          return { ...rec, priceOnUSD };
        });
        const result = await Promise.all(changeReceipts);
        const amountUsd =
          result.reduce((acc, curr) => acc + curr.priceOnUSD, 0) / 10;

        const wallet = await this.walletService.getUserForAddress({ address });
        await this.userService.plusPointForUser(
          { botId: wallet.ownerId.botId },
          Math.ceil(amountUsd),
        );
        if (wallet.ownerId.referrer) {
          await this.userService.plusPointForUser(
            { code: wallet.ownerId.referrer },
            Math.ceil(amountUsd / 10),
          );
        }
        console.log(
          `- botId: ${wallet.ownerId.botId}\n- point: ${Math.ceil(amountUsd)}`,
        );

        return {
          length: receipts.length,
          address,
          startTime,
          convertRecs: result,
        };
      };

      const date = new Date(time).getTime();
      const checkAllWallet = wallets.map(
        async (wal) => await transDeposit(wal.address, date),
      );
      const result = await Promise.all(checkAllWallet);
      console.log('Done Deposit Cronjob');
      return result;
    } catch (error) {
      console.log('error handle deposit task:', error.message);
    }
  }

  async handleHashtag() {
    try {
      const tasks = await this.taskService.findAll({});
      const { listIdXUser, hashtag, listX } =
        await this.taskCronjob.verifySocialHashtagCEN('#cenbot', tasks);

      return { listIdXUser, hashtag, listX };
    } catch (error) {
      console.log('error handle hash tags task:', error.message);
    }
  }

  async handleSocialTask() {
    try {
      const tasks = await this.taskService.findAll({});

      // introduction verify
      const intro_id =
        this.configService.getOrThrow<string>('X_INTRODUCTION_ID');
      const introduction_likes = await this.taskCronjob.verifySocialLikedCEN(
        tasks.filter((task) => task.introduction_like),
        intro_id,
      );
      if (introduction_likes.listX.length > 0) {
        await Promise.all([
          ...introduction_likes.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { introduction_like: false },
            ),
          ),
          ...introduction_likes.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }
      const introduction_retweets =
        await this.taskCronjob.verifySocialRetweetsCEN(
          tasks.filter((task) => task.introduction_retweet),
          intro_id,
        );
      if (introduction_retweets.listX.length > 0) {
        await Promise.all([
          ...introduction_retweets.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { introduction_retweet: false },
            ),
          ),
          ...introduction_retweets.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }

      // partnership verify
      const partner_id =
        this.configService.getOrThrow<string>('X_PARTNERSHIP_ID');
      const partnership_likes = await this.taskCronjob.verifySocialLikedCEN(
        tasks.filter((task) => task.partnership_like),
        partner_id,
      );
      if (partnership_likes.listX.length > 0) {
        await Promise.all([
          ...partnership_likes.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { partnership_like: false },
            ),
          ),
          ...partnership_likes.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }
      const partnership_retweets =
        await this.taskCronjob.verifySocialRetweetsCEN(
          tasks.filter((task) => task.partnership_retweet),
          partner_id,
        );
      if (partnership_retweets.listX.length > 0) {
        await Promise.all([
          ...partnership_retweets.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { partnership_like: false },
            ),
          ),
          ...partnership_retweets.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }

      // censpecial verify
      const special_id =
        this.configService.getOrThrow<string>('X_CENSPECIAL_ID');
      const censpecial_likes = await this.taskCronjob.verifySocialLikedCEN(
        tasks.filter((task) => task.censpecial_like),
        special_id,
      );
      if (censpecial_likes.listX.length > 0) {
        await Promise.all([
          ...censpecial_likes.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { censpecial_like: false },
            ),
          ),
          ...censpecial_likes.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }
      const censpecial_retweets =
        await this.taskCronjob.verifySocialRetweetsCEN(
          tasks.filter((task) => task.censpecial_retweet),
          special_id,
        );
      if (censpecial_retweets.listX.length > 0) {
        await Promise.all([
          ...censpecial_retweets.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { censpecial_retweet: false },
            ),
          ),
          ...censpecial_retweets.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }

      // iscen verify
      const iscen_id = this.configService.getOrThrow<string>('X_ISCEN_ID');
      const iscen_likes = await this.taskCronjob.verifySocialLikedCEN(
        tasks.filter((task) => task.iscen_retweet),
        iscen_id,
      );
      if (iscen_likes.listX.length > 0) {
        await Promise.all([
          ...iscen_likes.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { iscen_like: false },
            ),
          ),
          ...iscen_likes.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }
      const iscen_retweets = await this.taskCronjob.verifySocialRetweetsCEN(
        tasks.filter((task) => task.iscen_retweet),
        iscen_id,
      );
      if (iscen_retweets.listX.length > 0) {
        await Promise.all([
          ...iscen_retweets.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { iscen_retweet: false },
            ),
          ),
          ...iscen_retweets.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }

      // mission verify
      const mission_id = this.configService.getOrThrow<string>('X_MISSION_ID');
      const mission_likes = await this.taskCronjob.verifySocialLikedCEN(
        tasks.filter((task) => task.mission_like),
        mission_id,
      );
      if (mission_likes.listX.length > 0) {
        await Promise.all([
          ...mission_likes.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { mission_like: false },
            ),
          ),
          ...mission_likes.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }
      const mission_retweets = await this.taskCronjob.verifySocialRetweetsCEN(
        tasks.filter((task) => task.mission_retweet),
        mission_id,
      );
      if (mission_retweets.listX.length > 0) {
        await Promise.all([
          ...mission_retweets.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { mission_retweet: false },
            ),
          ),
          ...mission_retweets.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }

      // vision verify
      const vision_id = this.configService.getOrThrow<string>('X_VISION_ID');
      const vision_likes = await this.taskCronjob.verifySocialLikedCEN(
        tasks.filter((task) => task.mission_like),
        vision_id,
      );
      if (vision_likes.listX.length > 0) {
        await Promise.all([
          ...vision_likes.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { mission_like: false },
            ),
          ),
          ...vision_likes.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }
      const vision_retweets = await this.taskCronjob.verifySocialRetweetsCEN(
        tasks.filter((task) => task.mission_retweet),
        vision_id,
      );
      if (vision_retweets.listX.length > 0) {
        await Promise.all([
          ...vision_retweets.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { mission_retweet: false },
            ),
          ),
          ...vision_retweets.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }

      // bounty verify
      const bounty_id = this.configService.getOrThrow<string>('X_BOUNTY_ID');
      const bounty_likes = await this.taskCronjob.verifySocialLikedCEN(
        tasks.filter((task) => task.bounty_like),
        bounty_id,
      );
      if (bounty_likes.listX.length > 0) {
        await Promise.all([
          ...bounty_likes.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { bounty_like: false },
            ),
          ),
          ...bounty_likes.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }
      const bounty_retweets = await this.taskCronjob.verifySocialRetweetsCEN(
        tasks.filter((task) => task.bounty_retweet),
        bounty_id,
      );
      if (bounty_retweets.listX.length > 0) {
        await Promise.all([
          ...bounty_retweets.listX.map((item) =>
            this.taskService.update(
              { _id: item.taskId },
              { bounty_retweet: false },
            ),
          ),
          ...bounty_retweets.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }

      // follow verify
      const followers = await this.taskCronjob.verifySocialFollowerCEN(
        tasks.filter((task) => task.following),
      );
      if (followers.listX.length > 0) {
        await Promise.all([
          ...followers.listX.map((item) =>
            this.taskService.update({ _id: item.taskId }, { following: false }),
          ),
          ...followers.listX.map((item) =>
            this.userService.plusPointForUser({ xId: item.xId }, -1),
          ),
        ]);
      }

      console.log('Done Social Cronjob');
      return {
        data: {
          retweets: {
            introduction_retweets,
            partnership_retweets,
            censpecial_retweets,
            iscen_retweets,
            mission_retweets,
            vision_retweets,
          },
          likes: {
            introduction_likes,
            partnership_likes,
            censpecial_likes,
            iscen_likes,
            mission_likes,
            vision_likes,
          },
          followers,
        },
        message: 'Verify Social Task Success!',
      };
    } catch (error) {
      console.log('error handle social task:', error.message);
    }
  }

  async handleDailyTask() {
    try {
      const listTask = await this.taskService.findAll({});
      const convertListTask = listTask.filter((task) => task.swap > 10);

      const updates = await Promise.all(
        convertListTask.map(async (task) => {
          if (task.swap === 0) return 0;
          this.logger.log('Daily Task Cron!');

          const amount = formatPrice(task.swap / 10);
          const user = await this.userService.getOne({ _id: task.userId });
          await Promise.all([
            await this.userService.update(
              { _id: user._id },
              { point: user.point + amount },
            ),
            await this.taskService.update({ _id: task._id }, { swap: 0 }),
          ]);

          if (user.referrer) {
            const ref = await this.userService.getOne({ code: user.referrer });
            if (ref) {
              await this.userService.update(
                { _id: task.userId },
                { point: ref.point + formatPrice(amount / 10) },
              );
            }
          }
        }),
      );
      return updates;
    } catch (error) {
      console.log('error handle daily task:', error.message);
    }
  }
}

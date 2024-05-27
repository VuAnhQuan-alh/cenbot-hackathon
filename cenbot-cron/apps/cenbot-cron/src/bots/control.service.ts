import { FilterQuery } from 'mongoose';

import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Snipers } from '@schema/schema-app/schema/sniper.schema';
import { Tasks } from '@schema/schema-app/schema/task.schema';
import { Users } from '@schema/schema-app/schema/users.schema';
import { Wallets } from '@schema/schema-app/schema/wallets.schema';
import { WalletsService } from '@user-address/address';
import { DTOUpdateWallet } from '@user-address/address/dto/update-wallet.dto';
import { UsersService } from '@user-core/users';
import { DTOCreateUser } from '@user-core/users/dto/create-user.dto';
import { DTOUpdateUser } from '@user-core/users/dto/update-user.dto';
import { SnipersService } from '@user-sniper/snipers';
import { DTOUpdateSniper } from '@user-sniper/snipers/dto/update-sniper.dto';
import { TasksService } from '@user-task/tasks';
import { DTOUpdateTask } from '@user-task/tasks/dto/update-task.dto';
import { TransactionsService } from '@user-trans/transactions';
import { DTOCreateTransaction } from '@user-trans/transactions/dto/create-transaction.dto';

import { formatSui, provider, wallet } from '../configs/provider';
import { getInfoAddress } from '../utils/trade';
import { LiquiditiesService } from '@user-sniper/snipers/liquidities.service';
// import { SwappedService } from '@user-sniper/snipers/swapped.service';
import { DTOCreateSniper } from '@user-sniper/snipers/dto/create-sniper.dto';
import { Liquidities } from '@schema/schema-app/schema/liquidity.schema';

@Injectable()
export class ControlService {
  constructor(
    private readonly userService: UsersService,
    private readonly taskService: TasksService,
    private readonly transService: TransactionsService,
    private readonly walletService: WalletsService,
    private readonly sniperService: SnipersService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly liquidity: LiquiditiesService,
    // private readonly swap: SwappedService,
    private readonly snipe: SnipersService,
  ) {}

  async getAllUser(query: FilterQuery<Users>) {
    try {
      return await this.userService.findAll(query);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async replaceWalletNotVerify() {
    try {
      const usersNotVerify = await this.userService.findAll({ verify: false });
      return await Promise.all(
        usersNotVerify.map(async (user) => {
          const keypair = wallet();

          return await this.walletService.updateMany(
            { ownerId: user._id },
            {
              address: keypair.toSuiAddress(),
              privateKey: keypair.getSecretKey(),
            },
          );
        }),
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async replaceWalletSecret(ownerIds: string[]) {
    try {
      const wallets = await Promise.all(
        ownerIds.map(async (ownerId) => {
          const keypair = wallet();
          const user = await this.userService.getOne({ _id: ownerId });

          return await this.walletService.updateMany(
            { ownerId: user._id },
            {
              address: keypair.toSuiAddress(),
              privateKey: keypair.getSecretKey(),
            },
          );
        }),
      );
      return wallets;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getSnipe(query: FilterQuery<Snipers>) {
    return await this.snipe.getSniper(query);
  }

  async getAllSnipe(query: FilterQuery<Snipers>) {
    return await this.snipe.findAll(query);
  }

  async getCountSnipe(query: FilterQuery<Snipers>) {
    return await this.snipe.count(query);
  }

  async getSuccessSnipe() {
    return await this.snipe.findAll({ swapped: true });
  }

  async getLiquidity(query: FilterQuery<Liquidities>) {
    return await this.liquidity.getLiquidity(query);
  }

  async getResponse(path: string) {
    return await this.httpService.axiosRef.get(path, {
      responseType: 'arraybuffer',
    });
  }

  async checkExactlySnipe(token: string) {
    return (
      (await this.liquidity.count({
        $or: [{ coin_x: token }, { coin_y: token }],
      })) > 0
    );
  }

  async checkExactlyToken(coinType: string) {
    const response = await this.httpService.axiosRef.get(
      this.configService
        .getOrThrow<string>('API_COIN_CHECK')
        .replace('{coinId}', coinType),
    );

    return response.data;
  }

  async getInformationSUI() {
    try {
      const [block, gas, price] = await Promise.all([
        provider.getLatestSuiSystemState(),
        provider.getReferenceGasPrice(),
        this.getTokenPrice('sui'),
      ]);
      return {
        block: block.epoch || '0',
        gas: gas.toString() || '0',
        price: price?.price?.sui?.usd?.toString() || '0',
      };
    } catch (error) {
      console.log('error SUI =>', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async getTokenPrice(ids: string) {
    try {
      const data = await this.httpService.axiosRef(
        this.configService.get<string>('API_COIN_PRICE'),
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.75 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
          },
          params: { ids, vs_currencies: 'usd' },
        },
      );
      return { price: data.data };
    } catch (error) {
      console.log('error token price =>', error.message);

      // throw new BadRequestException(error.message);
    }
  }

  async createWallet(botId: number) {
    try {
      const user = await this.userService.getOne({ botId });
      const wallets = await this.walletService.getWallets({
        ownerId: user._id,
      });

      const keypair = wallet();
      if (wallets.length < 5) {
        await this.walletService.create({
          address: keypair.toSuiAddress(),
          // privateKey: `0x${toHEX(fromB64(wallet().getSecretKey()))}`,
          privateKey: keypair.getSecretKey(),
          ownerId: user,
          main: false,
        });
        return 'Created new address successful!';
      } else {
        return 'There are only 5 addresses per account!';
      }
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async replaceAllWallet(botId: number) {
    try {
      const user = await this.userService.getOne({ botId });
      const wallets = await this.walletService.getWallets({
        ownerId: user._id,
      });

      await Promise.all(
        wallets.map(async (wal) => {
          const keypair = wallet();
          await this.walletService.update(
            { _id: wal._id },
            {
              address: keypair.toSuiAddress(),
              privateKey: keypair.getSecretKey(),
            },
          );
        }),
      );
      return 'Created new address successful!';
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async createTransaction(data: DTOCreateTransaction) {
    try {
      return await this.transService.create(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async updateUser(query: FilterQuery<Users>, data: DTOUpdateUser) {
    try {
      return await this.userService.update(query, data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async updateWallet(query: FilterQuery<Wallets>, data: DTOUpdateWallet) {
    try {
      return await this.walletService.update(query, data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async createForUser(data: DTOCreateUser) {
    try {
      console.time('bot-user');
      const user = await this.userService.getOne({ botId: data.botId });

      if (!user) {
        const new_user = await this.userService.create(data);

        const create_wallets = Array.from({ length: 2 }, () => wallet());

        const new_wallets = await Promise.all(
          create_wallets.map((wal, ind) =>
            this.walletService.create({
              address: wal.toSuiAddress(),
              privateKey: wal.getSecretKey(),
              ownerId: new_user,
              main: ind === 0,
            }),
          ),
        );

        const new_task = await this.taskService.create({
          userId: new_user,
          following: false,
          introduction_like: false,
          tweet: false,
          tweetId: [],
          introduction_retweet: false,
          daily: [],
          transfer: 0,
          swap: 0,
          partnership_like: false,
          partnership_retweet: false,
          censpecial_like: false,
          censpecial_retweet: false,
          iscen_like: false,
          iscen_retweet: false,
          mission_like: false,
          mission_retweet: false,
          vision_like: false,
          vision_retweet: false,
          bounty_like: false,
          bounty_retweet: false,
        });
        const rank = await this.userService.getUserTopRank(new_user.botId);
        console.log({ new_user, new_wallets, new_task, rank });

        return {
          new_user,
          task: new_task,
          count: 0,
          rank: rank,
          wallets: new_wallets.map((wal) =>
            Object.assign(wal, { balance: 0.0 }),
          ),
        };
      }

      const [wallets, top_rank, task, count_ref] = await Promise.all([
        this.walletService.getWallets({ ownerId: user._id }),
        this.userService.getUserTopRank(user.botId),
        this.taskService.getTask({ userId: user._id }),
        this.userService.getCountReferrer(user.code),
      ]);

      const balances = await Promise.all(
        wallets.map((wal) => provider.getBalance({ owner: wal.address })),
      );
      const list_wallets = wallets.map((wal, idx) =>
        Object.assign(wal, {
          balance: formatSui(balances[idx].totalBalance),
        }),
      );
      console.timeEnd('bot-user');

      return {
        user,
        task,
        rank: top_rank,
        count: count_ref,
        wallets: list_wallets,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async chainMainWallet(botId: number, _oldIndex: number, _newIndex: number) {
    try {
      const user = await this.userService.getOne({ botId });
      const listWallets = await this.walletService.getWallets({
        ownerId: user._id,
      });

      const result = await Promise.all([
        this.walletService.update(
          { address: listWallets[_oldIndex].address },
          { main: false },
        ),
        this.walletService.update(
          { address: listWallets[_newIndex].address },
          { main: true },
        ),
      ]);

      return { data: result, message: 'Change main wallet success!' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async importWallet(index: number, privateKey: string, botId: number) {
    try {
      const chooseWallet = await this.getWalletByIndex(botId, index);
      const newAddress = getInfoAddress(privateKey);

      const result = await this.walletService.update(
        { address: chooseWallet.data.address },
        {
          address: newAddress.address,
          privateKey: privateKey,
        },
      );

      return result;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getUsersRanking() {
    try {
      return await this.userService.getUserTopRank();
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getWalletByUser(
    query: FilterQuery<Users>,
    position: number,
  ): Promise<Wallets | null> {
    try {
      const user = await this.userService.getOne(query);
      if (!user) {
        return null;
      }
      const wallets = await this.walletService.getWallets({
        ownerId: user._id,
      });
      return wallets[position];
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getInfoWalletByUser(botId: number) {
    try {
      const user = await this.userService.getOne({ botId });
      if (!user) {
        return {
          data: null,
          message: 'User not found!',
        };
      }
      const wallets = await this.walletService.getWallets({
        ownerId: user._id,
      });
      return {
        data: wallets,
        message: 'Get information wallets successful!',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async plusPointForUser(query: FilterQuery<Users>, point: number) {
    try {
      const user = await this.userService.getOne(query);
      if (!user) {
        return { data: null, message: 'User not found!' };
      }
      const result = await this.userService.update(
        { _id: user._id },
        { point: user.point + point },
      );
      return { data: result, message: 'Add points successful!' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async plusTransferForUser(query: FilterQuery<Tasks>, amount: number) {
    try {
      const task = await this.taskService.getTask(query);
      if (!task) {
        return {
          data: null,
          message: 'Task not found!',
        };
      }

      const result = await this.taskService.update(
        { _id: task._id },
        { transfer: task.transfer + amount },
      );
      return {
        data: result,
        message: 'Transfer amount successful!',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async plusSwapForUser(query: FilterQuery<Tasks>, amount: number) {
    try {
      const task = await this.taskService.getTask(query);
      if (!task) {
        return {
          data: null,
          message: 'Task not found!',
        };
      }

      const result = await this.taskService.update(
        { _id: task._id },
        { swap: task.swap + amount },
      );
      return {
        data: result,
        message: 'Swap amount successful!',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  private async getWalletByIndex(botId: number, index: number) {
    try {
      const wallets = await this.getInfoWalletByUser(botId);
      const result = wallets.data[index];

      if (!result) {
        return { data: null, message: 'Wallet not found!' };
      }
      return {
        data: result,
        message: 'Get wallet successful!',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getAll() {
    try {
      const wallets = await this.walletService.getWallets({});
      const users = await this.userService.findAll({});
      const tasks = await this.taskService.find({});

      const data = users.map((user) => ({
        task: tasks.find(
          (task) => task.userId.toString() === user._id.toString(),
        ),
        wallets: wallets.filter(
          (wallet) => wallet.ownerId.toString() === user._id.toString(),
        ),
      }));

      return {
        data,
        message: 'Get all data users and wallets',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getSnipeSuccessForUser(query: FilterQuery<Users>) {
    try {
      const user = await this.userService.getOne(query);
      return await this.sniperService.findAll({
        userId: user._id,
        swapped: true,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getSniperForUser(query: FilterQuery<Users>) {
    try {
      const user = await this.userService.getOne(query);
      const snipe = await this.sniperService.findAll({
        userId: user._id,
        swapped: false,
      });

      const walletSnipe = snipe
        // .filter((item) => !(item.autoSell && item.autoSell !== 'OFF'))
        .map((item) => item.wallets)
        .flat();
      const walletAuto = snipe
        // .filter((item) => item.autoSell && item.autoSell !== 'OFF')
        .map((item) => item.wallets)
        .flat();

      const tokenSnipe = snipe
        // .filter((item) => !(item.autoSell && item.autoSell !== 'OFF'))
        .map((item) => item.token);
      const tokenAuto = snipe
        // .filter((item) => item.autoSell && item.autoSell !== 'OFF')
        .map((item) => item.token);

      return {
        snipe,
        walletSnipe: walletSnipe || [],
        walletAuto: walletAuto || [],
        tokenSnipe,
        tokenAuto,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async createSniper(data: DTOCreateSniper) {
    try {
      return await this.sniperService.create(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async updateSniper(query: FilterQuery<Snipers>, data: DTOUpdateSniper) {
    try {
      return await this.sniperService.update(query, data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async updateTaskForUser(query: FilterQuery<Users>, data: DTOUpdateTask) {
    try {
      const user = await this.userService.getOne(query);
      if (!user) return null;

      return await this.taskService.update({ userId: user._id }, data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getTaskForUser(query: FilterQuery<Users>) {
    try {
      const user = await this.userService.getOne(query);
      if (!user) return null;

      return await this.taskService.getTask({ userId: user._id });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async resetAllTask() {
    try {
      const users = await this.userService.findAll({});
      const tasks = await this.taskService.findAll({});
      return await Promise.all([
        ...users.map(
          async (user) =>
            await this.userService.update({ _id: user._id }, { point: 0 }),
        ),
        ...tasks.map(
          async (task) =>
            await this.taskService.update(
              { _id: task._id },
              {
                following: false,
                introduction_like: false,
                introduction_retweet: false,
                partnership_like: false,
                partnership_retweet: false,
                censpecial_like: false,
                censpecial_retweet: false,
                iscen_like: false,
                iscen_retweet: false,
                mission_like: false,
                mission_retweet: false,
                vision_like: false,
                vision_retweet: false,
              },
            ),
        ),
      ]);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}

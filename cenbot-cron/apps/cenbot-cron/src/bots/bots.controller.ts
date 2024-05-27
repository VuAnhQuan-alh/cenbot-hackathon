import { Response as Res } from 'express';

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Response,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { CroDataService } from '@task-cro/cro-data';
import { DTOUpdateWallet } from '@user-address/address/dto/update-wallet.dto';

import { AwsUploadService } from './aws-upload.service';
import { BotsService } from './bots.service';
import { ControlService } from './control.service';

@Controller('bot')
export class BotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly controlService: ControlService,
    private readonly configService: ConfigService,
    private readonly croDataService: CroDataService,
    private readonly awsUpload: AwsUploadService,
  ) {}

  async asyncFn(fn: () => void) {
    return new Promise((resolve) => setTimeout(() => resolve(fn()), 10 * 1000));
  }

  @Get()
  GET_BOT() {
    return { message: this.croDataService.getString() };
  }

  @Put('replace-wallets')
  async REPLACE_WALLETS(@Body() body: { ownerIds: string[] }) {
    const data = await this.controlService.replaceWalletSecret(body.ownerIds);
    return { data, message: 'Replace all wallets successful!' };
  }

  @Get('replace-wallet-not-verify')
  async REPLACE_WALLET_NOT_VERIFY() {
    const data = await this.controlService.replaceWalletNotVerify();
    return { data, message: 'Replace all wallets successful!' };
  }

  @Get('snipe-success')
  async GET_SNIPE_SUCCESS() {
    const data = await this.controlService.getSuccessSnipe();
    return { data, message: 'Get all snipe token success' };
  }

  @Get('snipe-info/:snipeId')
  async SNIPE_INFORMATION(@Param('snipeId') snipeId: string) {
    const data = await this.controlService.getSnipe({ _id: snipeId });
    return { data, message: 'Get information snipe success' };
  }

  @Post('export-snipe/:snipeId')
  @UseInterceptors(FileInterceptor('image'))
  async EXPORT_SNIPE(
    @Param('snipeId') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.awsUpload.uploadFile(file, id);
    return { data: { id, file }, message: 'Uploaded' };
  }

  @Get('snipe-pnl/:botId/:snipeId/:amount')
  async TEST_SNIPE_PNL(
    @Param('botId') botId: string,
    @Param('snipeId') snipeId: string,
    @Param('amount') amount: string,
  ) {
    return await this.botsService.sendPnlSnipe(+botId, snipeId, amount);
  }

  @Get('snipe-antirug/:token')
  async TEST_SNIPE_ANTIRUG(@Param('token') token: string) {
    return await this.botsService.sendMessageAntiRug(token);
  }

  @Get('snipe-autosell/:token')
  async TEST_AUTO_SELL(@Param('token') token: string) {
    return await this.botsService.sendMessageAutoSell(token);
  }

  @Get('snipe/:uri/:path')
  async SEND_SNIPE(@Param('uri') snipeId: string, @Param('path') path: string) {
    return await this.botsService.sendImagePnl(snipeId, path);
  }

  @Get('twitter/:action/:id/:mess/:path')
  async OPEN_TWITTER(
    @Param('action') action: string,
    @Param('id') id: string,
    @Param('mess') mess_id: string,
    @Param('path') path: string,
    @Response() response: Res,
  ) {
    const uris = {
      introduction: {
        url: this.configService.getOrThrow<string>('X_INTRODUCTION_URL'),
        property: 'introduction',
        uri_follow: this.configService.getOrThrow<string>(
          'X_CENBOT_FOLLOW_URI',
        ),
      },
      partnership: {
        url: this.configService.getOrThrow<string>('X_PARTNERSHIP_URL'),
        property: 'partnership',
      },
      censpecial: {
        url: this.configService.getOrThrow<string>('X_CENSPECIAL_URL'),
        property: 'censpecial',
      },
      iscen: {
        url: this.configService.getOrThrow<string>('X_ISCEN_URL'),
        property: 'iscen',
      },
      mission: {
        url: this.configService.getOrThrow<string>('X_MISSION_URL'),
        property: 'mission',
      },
      vision: {
        url: this.configService.getOrThrow<string>('X_VISION_URL'),
        property: 'vision',
      },
      bounty: {
        url: this.configService.getOrThrow<string>('X_BOUNTY_URL'),
        property: 'bounty',
      },
    };

    if (action === 'follow') {
      response.redirect(uris[path].uri_follow);
    } else {
      response.redirect(uris[path].url);
    }

    const task = await this.controlService.getTaskForUser({
      botId: Number(id),
    });
    console.log({ action, id, mess_id, path, task });

    if (!task.following && action === 'follow') {
      const func = async () => {
        await this.controlService.updateTaskForUser(
          { botId: Number(id) },
          { following: true },
        );
        await this.controlService.plusPointForUser({ botId: Number(id) }, 1);
        console.log('plus point to follow: ', id);
      };
      await this.asyncFn(func);

      return await this.botsService.updateFollowChat(
        Number(id),
        Number(mess_id),
      );
    }

    if (!task[`${path}_like`] && action === 'like') {
      const func = async () => {
        await this.controlService.updateTaskForUser(
          { botId: Number(id) },
          { [`${path}_like`]: true },
        );
        await this.controlService.plusPointForUser({ botId: Number(id) }, 1);
        console.log('plus point to like: ', id);
      };
      await this.asyncFn(func);

      return await this.botsService.updateLikeChat(Number(id), Number(mess_id));
    }

    if (!task[`${path}_retweet`] && action === 'retweet') {
      const func = async () => {
        await this.controlService.updateTaskForUser(
          { botId: Number(id) },
          { [`${path}_retweet`]: true },
        );
        await this.controlService.plusPointForUser({ botId: Number(id) }, 1);
        console.log('plus point to retweet: ', id);
      };
      await this.asyncFn(func);

      return await this.botsService.updateRetweetChat(
        Number(id),
        Number(mess_id),
      );
    }

    return { message: 'Open twitter!' };
  }

  @Get('all-data')
  async GET_ALL() {
    return this.controlService.getAll();
  }

  @Get('wallet-by-user/:id')
  async WALLET_BY_ID(@Param('id') id: string) {
    return this.controlService.getInfoWalletByUser(Number(id));
  }

  @Put('wallet-update/:id')
  async WALLET_UPDATE_BY_ID(
    @Param('id') id: string,
    @Body() data: DTOUpdateWallet,
  ) {
    return this.controlService.updateWallet({ _id: id }, data);
  }

  @Get('menu/:id')
  GET_MENU(@Param('id') id: string) {
    return this.botsService.updateMenuQuest(Number(id), true);
  }

  @Get('ranking')
  async GET_RANKING() {
    const data = await this.controlService.getUsersRanking();
    return {
      data: data.map((user) => ({
        username: user.username,
        twitterId: user.xUsername,
        point: user.point,
        code: user.code,
        avatar: user.xAvatar,
      })),
      message: 'Get top ranking for user.',
    };
  }

  @Get('reset-task')
  async RESET_TASK() {
    const data = await this.controlService.resetAllTask();
    if (!data) return { data: null, message: 'Reset tasks failed!' };

    return { data, message: 'Reset tasks successful!' };
  }
}

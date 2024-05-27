import * as nanoid from 'nanoid';

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@user-core/users';
import { TaskCronService } from '@task-cron/task-cron';

@Injectable()
export class OauthService {
  constructor(
    private readonly userService: UsersService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly taskCron: TaskCronService,
  ) {}
  async getCodeVerified(): Promise<string> {
    const genCode = nanoid.customAlphabet(
      '1234567890abcdefghijklmnopqrstuvwxyz',
    );
    while (true) {
      const code = genCode(8);
      if (!(await this.userService.getOne({ code }))) {
        return code;
      }
    }
  }

  async getOAuthCallback(
    botId: number,
    xAccount: { id: string; name: string; username: string },
  ) {
    const code = await this.getCodeVerified();
    const dataX = await this.taskCron.getUserDetail(xAccount.id);

    const isUser = await this.userService.update(
      { botId },
      {
        xId: xAccount.id,
        xUsername: xAccount.username,
        xAvatar: dataX?.data?.profile_pic_url || '',
        verify: true,
        code,
      },
    );
    const url = this.configService.getOrThrow<string>('BE_URL');
    this.httpService.get(`${url}/bot/menu/${botId}`).subscribe((data) => data);

    return {
      data: isUser,
      message: 'Verified twitter success!',
    };
  }
}

import TelegramBot from 'node-telegram-bot-api';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { BotsService } from '../bots.service';

@Injectable()
export class SnipeTokenService implements OnModuleInit {
  private bot: TelegramBot;

  constructor(private readonly botService: BotsService) {
    this.bot = this.botService.bot;
  }

  onModuleInit() {
    this.bot.on('message', this.onReceivedMessage.bind(this));
  }

  private async onReceivedMessage(message: TelegramBot.Message) {
    if (message.reply_to_message) {
      const reply = message.reply_to_message;

      if (reply.text.includes('callback one')) {
        console.log('\nreply:', reply.text, '\ntext:', message.text);
      }
    }
  }
}

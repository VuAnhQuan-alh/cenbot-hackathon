import * as Bluebird from 'bluebird';
import { Bot, GrammyError, HttpError } from 'grammy';
import Jimp from 'jimp';
import * as nanoid from 'nanoid';
import * as TelegramBot from 'node-telegram-bot-api';

import { DexSdkService } from '@dex-sdk/dex-sdk';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionType } from '@schema/schema-app/types/enum';
import { CroDataService } from '@task-cro/cro-data';
import { TaskCronService } from '@task-cron/task-cron';

import { TypeToken } from '../configs/index';
import { formatPrice } from '../configs/provider';
import { replaceText, replaceTextItalic } from '../utils/convert';
import {
  getAllBalances,
  getBalanceMeta,
  getCoinBalance,
  getOneBalance,
  getPriceSui,
  trade,
  transferCoin,
} from '../utils/trade';
import { ControlService } from './control.service';
import { MenuServices } from './menu.service';

@Injectable()
export class BotsService implements OnModuleInit {
  public bot: TelegramBot;
  private readonly logger = new Logger(BotsService.name);
  private readonly grammy: Bot;

  constructor(
    private readonly config: ConfigService,
    private readonly control: ControlService,
    private readonly croData: CroDataService,
    private readonly dexSdk: DexSdkService,
    private readonly menu: MenuServices,
    private readonly taskCron: TaskCronService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const tokenTel = this.config.getOrThrow<string>('TELEGRAM_TOKEN');
    this.bot = new TelegramBot(tokenTel, { polling: true });
    this.grammy = new Bot(tokenTel);
  }

  public InfoSUI = {
    BLOCK: '0',
    GAS: '0',
    PRICE: '0',
  };
  private ActionsWALLET = {
    IMPORT: {}, // 'replace_wallet_1',
  };
  private TypeCoinTRADE = TypeToken;
  private ActionsTRANSFER = {
    AMOUNT: {}, // 'transfer_amount_0.1',
    CUSTOM: {}, // '',
    FROM: {}, // 'transfer_from_wallet_1',
    MODE: {}, // 'SUI',
    PERCENT: {}, // 'transfer_percent_0.25',
    TO: {}, // 'transfer_to_wallet_1',
    TOKEN: {}, // 'transfer_sui_tokens',
    WALLET_TO: {}, // '',
  };
  private ActionsSWAP = {
    ACTION: {}, // 'swap_buy_token',
    AMOUNT: {}, // 'swap_amount_0.1',
    CUSTOM_AMOUNT: {}, // '',
    CUSTOM_SLIP: {}, // '',
    CUSTOM_TOKEN: {}, // '',
    MODE: {}, // 'swap_easy_mode',
    REPLY: {}, // false,
    SLIPPAGE: {}, // 'swap_slippage_auto',
    TOKEN: {}, // 'swap_token_sui',
    TYPE: {}, // 'swap_sui_type',
    WALLET: {}, // 'swap_wallet_1',
  };
  private ActionsSNIPE = {
    ANTI_RUG: {}, // false,
    AUTO_SELL: {}, // 'OFF',
    FIRST_FAIL: {}, // false,
    MAX_SPEND: {}, // '',
    WALLETS: {}, // [],
  };

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCallbackCron() {
    await this.handleUpdateInformationSUI();
    this.logger.log('Updated Information SUI Token');
  }

  async handleUpdateInformationSUI() {
    const info = await this.control.getInformationSUI();
    this.InfoSUI.BLOCK = info?.block || '0';
    this.InfoSUI.GAS = info?.gas || '0';
    this.InfoSUI.PRICE = info?.price || '0';
    await this.cacheManager.set('sui-price', this.InfoSUI.PRICE);
  }

  async onModuleInit() {
    if (this.config.getOrThrow<string>('NODE_ENV') === 'production') {
      Bluebird.config({ cancellation: true });
      this.logger.log('Initial Bluebird!');
    }
    await this.initActions();
    await this.handleUpdateInformationSUI();

    this.grammy.api
      .setMyCommands([
        { command: 'start', description: 'Open main menu' },
        { command: 'clear', description: 'Clear chat context' },
      ])
      .catch((err) => {
        const ctx = err.ctx;
        console.log(`Error while handling update ${ctx.update.update_id}:`);
        const e = err.error;
        if (e instanceof GrammyError) {
          console.log('Error in request:', e.description);
        } else if (e instanceof HttpError) {
          console.log('Could not contact Telegram:', e);
        } else {
          console.log('Unknown error:', e);
        }
      });

    this.bot.onText(/\/clear/, async (msg) => {
      for (let i = 0; i < 251; i++) {
        this.bot
          .deleteMessage(msg.chat.id, msg.message_id + 50 - i)
          .catch(() => {
            return;
          });
      }
      this.updateMenuQuest(msg.chat.id);
    });

    this.bot.onText(/\/start (.+)|\/start/i, async (message, match) => {
      if (!match[1]) return 0;

      const {
        from: { username = '', id },
      } = message;
      const code = this.getCodeVerified();

      const { user } = await this.control.createForUser({
        username,
        botId: id,
        point: 0,
        verify: false,
        xId: '',
        xUsername: '',
        xAvatar: '',
        code,
        referrer: '',
      });

      if (user?.referrer) {
        this.bot.sendMessage(
          id,
          replaceTextItalic('⚠️ _Your account has used a referral code_ !'),
          { parse_mode: 'MarkdownV2' },
        );
        return 0;
      }

      if (user?.code === match[1]) {
        this.bot.sendMessage(
          message.chat.id,
          replaceTextItalic(
            '⚠️ _You cannot send referral codes to yourself_ !',
          ),
          { parse_mode: 'MarkdownV2' },
        );
        return 0;
      }

      await Promise.all([
        this.control.updateUser({ botId: id }, { referrer: match[1] }),
        this.control.plusPointForUser({ code: match[1] }, 1),
        this.control.plusPointForUser({ botId: id }, 1),
      ]);
      this.updateMenuQuest(message.chat.id);
    });

    this.bot.on('message', this.onReceivedMessage.bind(this));

    this.bot.on('polling_error', (err) => {
      console.log('polling-error:', err.message);
      return;
    });

    // === X: root sniper === //
    // == 1: root_sniper == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_sniper') {
          const {
            infoAccount: text,
            textWallet,
            wallets,
          } = await this.getAllInfoChat(query.message);

          const snipe = await this.control.getSniperForUser({
            botId: query.message.chat.id,
          });
          const url = this.config.getOrThrow<string>('CLIENT_REDIRECT_URL');

          await this.menu.rootSniper({
            uri: url,
            wallets,
            bot: this.bot,
            text,
            textWallet,
            message: query.message,
            walletTokens: snipe.walletSnipe,
            walletAutos: snipe.walletAuto,
            tokenSnipe: snipe.snipe,
            message_id: query.message.message_id,
          });
        }
      } catch (error) {
        console.log('error root sniper:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 2: token_sniper_menu == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'token_sniper_menu') {
          console.time('token_sniper_menu');
          // console.log({ snipe: this.ActionsSNIPE });

          const {
            functionSnipeWallet,
            infoAccount: text,
            wallets,
          } = await this.getAllInfoChat(query.message);
          const textMenu =
            text +
            `══🎯 *Token Sniper* 🎯══\n*Token Sniper*: Enter token addresses you wish to snipe or import tokens from the deploy scanner.\n\n`;
          const sniper = await this.control.getSniperForUser({
            botId: query.message.chat.id,
          });

          await this.menu.tokenSniper({
            bot: this.bot,
            text: textMenu,
            function: functionSnipeWallet,
            walletToken: this.ActionsSNIPE.WALLETS[query.message.chat.id] || [],
            sniperToken: sniper.tokenSnipe,
            wallets,
            message: query.message,
            maxSpend: this.ActionsSNIPE.MAX_SPEND[query.message.chat.id],
            autoSell: this.ActionsSNIPE.AUTO_SELL[query.message.chat.id],
            firstFail: this.ActionsSNIPE.FIRST_FAIL[query.message.chat.id],
            antiRug: this.ActionsSNIPE.ANTI_RUG[query.message.chat.id],
            send: false,
          });
          console.timeEnd('token_sniper_menu');
        }
      } catch (error) {
        console.log('error token sniper menu:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 4: sniper_wallet == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'token_sniper_wallet_1',
            'token_sniper_wallet_2',
            'token_sniper_wallet_3',
            'token_sniper_wallet_4',
            'token_sniper_wallet_5',
          ].includes(query.data)
        ) {
          const position = +query.data.split('_')[3] - 1;

          const {
            functionSnipeWallet,
            infoAccount: text,
            wallets,
          } = await this.getAllInfoChat(query.message);
          const textMenu =
            text +
            `══🎯 *Token Sniper* 🎯══\n*Token Sniper*: Enter token addresses you wish to snipe or import tokens from the deploy scanner.\n\n`;

          const wallet = wallets[position];
          const newData = [
            ...((this.ActionsSNIPE.WALLETS[query.message.chat.id] || []).find(
              (item) => item === wallet.address,
            )
              ? (this.ActionsSNIPE.WALLETS[query.message.chat.id] || []).filter(
                  (item) => item !== wallet.address,
                )
              : [
                  ...(this.ActionsSNIPE.WALLETS[query.message.chat.id] || []),
                  wallet.address,
                ]),
          ];
          this.ActionsSNIPE.WALLETS[query.message.chat.id] = newData;

          const sniper = await this.control.getSniperForUser({
            botId: query.message.chat.id,
          });

          // console.log({ snipe: this.ActionsSNIPE });
          console.time('token-sniper-wallet');
          await this.menu.tokenSniper({
            bot: this.bot,
            text: textMenu,
            function: functionSnipeWallet,
            walletToken: this.ActionsSNIPE.WALLETS[query.message.chat.id] || [],
            sniperToken: sniper.tokenSnipe,
            wallets,
            message: query.message,
            maxSpend: this.ActionsSNIPE.MAX_SPEND[query.message.chat.id],
            autoSell: this.ActionsSNIPE.AUTO_SELL[query.message.chat.id],
            firstFail: this.ActionsSNIPE.FIRST_FAIL[query.message.chat.id],
            antiRug: this.ActionsSNIPE.ANTI_RUG[query.message.chat.id],
            send: false,
          });
          console.timeEnd('token-sniper-wallet');
        }
      } catch (error) {
        console.log('error switch wallet snipe:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 5: auto_sniper_menu == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'auto_sniper_menu') {
          const {
            functionSnipeWallet,
            infoAccount: text,
            wallets,
          } = await this.getAllInfoChat(query.message);

          const textMenu =
            text +
            `══🎯 *Auto Sniper* 🎯══\n*Auto Sniper*: Automatically snipe tokens when the amount of users sniping the token hits your threshold number. Autosnipes use First or Fail settings which means you only hit when you are bottom of the block which significantly reduces risk.\n\n`;
          const sniper = await this.control.getSniperForUser({
            botId: query.message.chat.id,
          });

          // console.log({ snipe: this.ActionsSNIPE });
          console.time('menu-auto-snipe');
          await this.menu.autoSniper({
            bot: this.bot,
            text: textMenu,
            function: functionSnipeWallet,
            walletToken: this.ActionsSNIPE.WALLETS[query.message.chat.id] || [],
            sniperToken: sniper.tokenAuto,
            wallets,
            message: query.message,
            snipeMaxSpend: this.ActionsSNIPE.MAX_SPEND[query.message.chat.id],
            snipeAutoSell: this.ActionsSNIPE.AUTO_SELL[query.message.chat.id],
            snipeAntiRug: this.ActionsSNIPE.ANTI_RUG[query.message.chat.id],
          });
          console.timeEnd('menu-auto-snipe');
        }
      } catch (error) {
        console.log('error auto sniper menu:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 7: auto_wallet == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      if (
        [
          'auto_sniper_wallet_1',
          'auto_sniper_wallet_2',
          'auto_sniper_wallet_3',
          'auto_sniper_wallet_4',
          'auto_sniper_wallet_5',
        ].includes(query.data)
      ) {
        try {
          const position = +query.data.split('_')[3] - 1;
          const {
            functionSnipeWallet,
            infoAccount: text,
            wallets,
          } = await this.getAllInfoChat(query.message);
          const textMenu =
            text +
            `══🎯 *Auto Sniper* 🎯══\n*Auto Sniper*: Automatically snipe tokens when the amount of users sniping the token hits your threshold number. Autosnipes use First or Fail settings which means you only hit when you are bottom of the block which significantly reduces risk.\n\n`;

          const wallet = wallets[position];
          const newData = [
            ...((this.ActionsSNIPE.WALLETS[query.message.chat.id] || []).find(
              (item) => item === wallet.address,
            )
              ? (this.ActionsSNIPE.WALLETS[query.message.chat.id] || []).filter(
                  (item) => item !== wallet.address,
                )
              : [
                  ...(this.ActionsSNIPE.WALLETS[query.message.chat.id] || []),
                  wallet.address,
                ]),
          ];
          this.ActionsSNIPE.WALLETS[query.message.chat.id] = newData;

          const sniper = await this.control.getSniperForUser({
            botId: query.message.chat.id,
          });

          // console.log({ snipe: this.ActionsSNIPE });
          console.time('auto-sniper-wallet');
          await this.menu.tokenSniper({
            bot: this.bot,
            text: textMenu,
            function: functionSnipeWallet,
            walletToken: this.ActionsSNIPE.WALLETS[query.message.chat.id] || [],
            sniperToken: sniper.tokenAuto,
            wallets,
            message: query.message,
            maxSpend: this.ActionsSNIPE.MAX_SPEND[query.message.chat.id],
            autoSell: this.ActionsSNIPE.AUTO_SELL[query.message.chat.id],
            firstFail: this.ActionsSNIPE.FIRST_FAIL[query.message.chat.id],
            antiRug: this.ActionsSNIPE.ANTI_RUG[query.message.chat.id],
            send: false,
          });
          console.timeEnd('auto-sniper-wallet');
        } catch (error) {
          console.log('error auto wallet menu:', error.message);
          this.bot
            .deleteMessage(query.message.chat.id, query.message.message_id)
            .catch(() => {
              return;
            })
            .finally(() => {
              this.updateMenuQuest(query.message.chat.id);
            });
        }
      }
    });

    // == 8: token_toggle_first_fail == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'token_toggle_first_fail') {
          const {
            functionSnipeWallet,
            infoAccount: text,
            wallets,
          } = await this.getAllInfoChat(query.message);
          const textMenu =
            text +
            `══🎯 *Token Sniper* 🎯══\n*Token Sniper*: Enter token addresses you wish to snipe or import tokens from the deploy scanner.\n\n`;

          const snipe = await this.control.getSniperForUser({
            botId: query.message.chat.id,
          });
          this.ActionsSNIPE.FIRST_FAIL[query.message.chat.id] =
            !this.ActionsSNIPE.FIRST_FAIL[query.message.chat.id];

          // console.log({ snipe: this.ActionsSNIPE });
          console.time('toggle-first-fail');
          await this.menu.tokenSniper({
            bot: this.bot,
            text: textMenu,
            function: functionSnipeWallet,
            walletToken: this.ActionsSNIPE.WALLETS[query.message.chat.id] || [],
            sniperToken: snipe.tokenSnipe,
            wallets,
            message: query.message,
            maxSpend: this.ActionsSNIPE.MAX_SPEND[query.message.chat.id],
            autoSell: this.ActionsSNIPE.AUTO_SELL[query.message.chat.id],
            firstFail: this.ActionsSNIPE.FIRST_FAIL[query.message.chat.id],
            antiRug: this.ActionsSNIPE.ANTI_RUG[query.message.chat.id],
            send: false,
          });
          console.timeEnd('toggle-first-fail');
        }
      } catch (error) {
        console.log('error token toggle first of fail:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 9: token_toggle_anti_rug == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'token_toggle_anti_rug') {
          const {
            functionSnipeWallet,
            infoAccount: text,
            wallets,
          } = await this.getAllInfoChat(query.message);
          const textMenu =
            text +
            `══🎯 *Token Sniper* 🎯══\n*Token Sniper*: Enter token addresses you wish to snipe or import tokens from the deploy scanner.\n\n`;

          this.ActionsSNIPE.ANTI_RUG[query.message.chat.id] =
            !this.ActionsSNIPE.ANTI_RUG[query.message.chat.id];

          const snipe = await this.control.getSniperForUser({
            botId: query.message.chat.id,
          });

          // console.log({ snipe: this.ActionsSNIPE });
          console.time('menu-rug');
          await this.menu.tokenSniper({
            bot: this.bot,
            text: textMenu,
            function: functionSnipeWallet,
            walletToken: this.ActionsSNIPE.WALLETS[query.message.chat.id] || [],
            sniperToken: snipe.tokenSnipe,
            wallets,
            message: query.message,
            maxSpend: this.ActionsSNIPE.MAX_SPEND[query.message.chat.id],
            autoSell: this.ActionsSNIPE.AUTO_SELL[query.message.chat.id],
            firstFail: this.ActionsSNIPE.FIRST_FAIL[query.message.chat.id],
            antiRug: this.ActionsSNIPE.ANTI_RUG[query.message.chat.id],
            send: false,
          });
          console.timeEnd('menu-rug');
        }
      } catch (error) {
        console.log('error token toggle anti rug:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 10: token_toggle_auto_sell == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'token_toggle_auto_sell') {
          this.bot.sendMessage(
            query.message.chat.id,
            replaceText(
              '🛠 Enter the amount \\(%, OFF\\) you want auto sell:\n*Ex:* 10%, OFF',
            ),
            { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
          );
          return 0;
        }
      } catch (error) {
        console.log('error token toggle auto sell:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 11: token_add_max_spend == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'token_add_max_spend') {
          this.bot.sendMessage(
            query.message.chat.id,
            replaceText(
              '🛠 Enter the max amount \\(SUI\\) you want spend sell:\n*Ex:* 10 SUI',
            ),
            { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
          );
          return 0;
        }
      } catch (error) {
        console.log('error token toggle auto sell:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 12: token_add_sniper == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'token_add_sniper') {
          this.bot.sendMessage(
            query.message.chat.id,
            replaceText('🎯 *Enter the token address you wish to snipe:*'),
            { parse_mode: 'MarkdownV2', reply_markup: { force_reply: true } },
          );
          return 0;
        }
      } catch (error) {
        console.log('error token add sniper:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 13: export_image_pnl == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'export_image_pnl') {
          const addTextToImage = async (imagePath: string) => {
            const response = await this.control.getResponse(imagePath);
            const buffer = Buffer.from(response.data, 'binary');

            const image = await Jimp.read(buffer);
            return await image.getBufferAsync(Jimp.MIME_PNG);
          };

          const pathPhoto =
            'https://pbs.twimg.com/profile_banners/1734504878234624000/1703417311/1500x500';
          const image = await addTextToImage(pathPhoto);

          this.bot.sendPhoto(query.message.chat.id, image, {
            caption: '📸 *PnL Photo*',
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✖️ Close', callback_data: 'close_current' }],
              ],
            },
          });
          return 0;
        }
      } catch (error) {
        console.log('error export image pnl:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 14: root_sniped_list == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_sniped_list') {
          const { infoAccount } = await this.getAllInfoChat(query.message);

          const snipe = await this.control.getSnipeSuccessForUser({
            botId: query.message.chat.id,
          });
          const listType = await Promise.all(
            snipe.map(async (item) => {
              const type = await getBalanceMeta(item.token);
              return { token: item.token, hash: item.hash, ...type };
            }),
          );
          const snipesId = listType.map((item) => ({
            text: item.name,
            callback_data: `snipe_token_${item.hash}`,
          }));
          const convertListSnipeId = [];
          if (snipesId.length > 3) {
            for (let i = 0; i < Math.ceil(snipesId.length / 3); i++) {
              convertListSnipeId.push([]);
              for (let j = 0; j < 3; j++) {
                if (3 * i + j < snipesId.length)
                  convertListSnipeId[i].push(snipesId[3 * i + j]);
              }
            }
          } else {
            convertListSnipeId.push(snipesId);
          }
          const text = `${infoAccount}═🎯  *Snipe List*  🎯═\n`;

          this.bot.editMessageText(replaceText(text), {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            disable_web_page_preview: true,
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔙️ Back', callback_data: 'root_sniper' },
                  { text: '⏪ Main menu', callback_data: 'edit_menu' },
                  { text: '✖️ Close', callback_data: 'close_current' },
                ],
                ...convertListSnipeId,
              ],
            },
          });
        }
      } catch (error) {
        console.log('error root sniper list:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 15: snipe_token == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      if (query.data.includes('snipe_token_')) {
        try {
          this.bot.sendMessage(
            query.message.chat.id,
            replaceText('💹 *Scanning ...*'),
            { parse_mode: 'MarkdownV2' },
          );
          const { infoAccount } = await this.getAllInfoChat(query.message);

          const url_ppk = this.config.getOrThrow<string>('BE_PPK_URL');
          const hash = query.data.split('_')[2];
          const snipe = await this.control.getSnipe({ hash });

          const type = await getBalanceMeta(snipe.token);
          const amount = (+snipe.maxSpend * Math.pow(10, 9)).toString();
          let price = 0;
          let amountToken = 0;

          if (snipe.swapDex === 'Cetus') {
            const { price: priceDex, amount: amountDex } =
              await this.dexSdk.pnlCetus(
                snipe.wallets[0],
                snipe.pool,
                +this.InfoSUI.PRICE,
              );
            price = Number(priceDex);
            amountToken = Number(amountDex);
          } else if (snipe.swapDex === 'FlowX') {
            const { price: priceDex, amount: amountDex } =
              await this.dexSdk.swapFlowX(
                snipe.wallets[0],
                {
                  type: snipe.token,
                  symbol: type.symbol,
                  decimals: type.decimals,
                },
                amount,
                +this.InfoSUI.PRICE,
                type.decimals,
              );
            price = Number(priceDex);
            amountToken = Number(amountDex);
          } else if (snipe.swapDex === 'Turbos') {
            const { price: priceDex, amount: amountDex } =
              await this.dexSdk.swapTurbos(
                snipe.wallets[0],
                snipe.pool,
                amount,
                +this.InfoSUI.PRICE,
              );
            price = Number(priceDex);
            amountToken = Number(amountDex);
          }

          const uri = `${url_ppk}/pnl?id=${snipe._id}&price=${price.toFixed(8)}`;
          const tokenPrice =
            +price * (+amountToken / Math.pow(10, type.decimals));

          const txURI = `https://suivision.xyz/txblock/${snipe.hash}`;
          const text = `${infoAccount}*#${type.name}*\n*Contact Address:* \`${snipe.token}\`\n*Balance:* ${Number(amountToken)} ${type.symbol} - $${formatPrice(tokenPrice)}\n\n*Wallet:* \`${snipe.wallets[0]}\`\n*DEX:* ${snipe.swapDex}\n*TXID:* [Link](${txURI})\n*Rate:* ${formatPrice(+price / +this.InfoSUI.PRICE)} SUI / 1 ${type.symbol}\n*PnL:* ${(((+price - +snipe.firstPrice) / +snipe.firstPrice) * 100).toFixed(0)}%`;

          this.bot.sendMessage(query.message.chat.id, replaceText(text), {
            disable_web_page_preview: true,
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⏪ Main menu', callback_data: 'edit_menu' },
                  { text: '✖️ Close', callback_data: 'close_current' },
                ],
                [{ text: 'Show Flex Pnl', web_app: { url: uri } }],
              ],
            },
          });
        } catch (error) {
          console.log('error snipe token:', error.message);
          this.bot
            .deleteMessage(query.message.chat.id, query.message.message_id)
            .catch(() => {
              return;
            })
            .finally(() => {
              this.updateMenuQuest(query.message.chat.id);
            });
        }
      }
    });

    // === VIII: market insight === //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_market_insight') {
          const { infoAccount: text } = await this.getAllInfoChat(
            query.message,
          );
          const textMenu = `*The Market Insight feature allows users to quickly get information about activities on SUI chain, top gainers, top pools*.`;

          this.bot.editMessageText(replaceText(text + textMenu), {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            disable_web_page_preview: true,
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Top Gainers',
                    callback_data: 'market_insight_gainers',
                  },
                  { text: 'Top Pools', callback_data: 'market_insight_pools' },
                ],
                [
                  { text: '✖️ Close', callback_data: 'edit_menu' },
                  { text: 'Your Market', callback_data: 'user_market_insight' },
                ],
              ],
            },
          });
        }
      } catch (error) {
        console.log('error token market insight root: ', error.message);
      }
    });
    // == 1: user_market_insight == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'user_market_insight',
            'market_wallet_1',
            'market_wallet_2',
            'market_wallet_3',
            'market_wallet_4',
            'market_wallet_5',
          ].includes(query.data)
        ) {
          this.bot.sendMessage(
            query.message.chat.id,
            replaceText('💹 *Scanning ...*'),
            { parse_mode: 'MarkdownV2' },
          );
          const {
            wallets,
            funcMenuWallet: functionMenu,
            textInfoHtml: text,
          } = await this.getAllInfoChat(query.message);
          const position =
            query.data.split('_')[2] === 'insight'
              ? 0
              : +query.data.split('_')[2] - 1;

          console.time('menu-market');
          await this.menu.tokenMarket({
            bot: this.bot,
            wallets,
            message: query.message,
            function: functionMenu,
            TYPE_COIN: this.TypeCoinTRADE,
            position,
            text,
          });
          console.timeEnd('menu-market');
          return 0;
        }
      } catch (error) {
        console.log('error user market insight:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 2: market_insight_pools == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'market_insight_pools') {
          this.bot.sendMessage(
            query.message.chat.id,
            replaceText('💹 *Scanning Top Pools...*'),
            { parse_mode: 'MarkdownV2' },
          );

          const { textInfoHtml: text } = await this.getAllInfoChat(
            query.message,
          );

          const cacheInsights = (await this.cacheManager.get(
            'list-pool',
          )) as any[];

          if (cacheInsights) {
            console.log('use cache pool insights');

            return await this.menu.insightPools({
              bot: this.bot,
              message: query.message,
              text,
              topInsights: cacheInsights,
            });
          }

          const topInsights = (await this.croData.crawPools()).data;
          await this.cacheManager.set('list-pool', topInsights, 1000 * 60 * 30);

          console.time('menu-pools');
          await this.menu.insightPools({
            bot: this.bot,
            message: query.message,
            text,
            topInsights: topInsights,
          });
          console.timeEnd('menu-pools');
          return 0;
        }
      } catch (error) {
        console.log('error top pools:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 3: market_insight_gainers == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'market_insight_gainers') {
          const { textInfoHtml: text } = await this.getAllInfoChat(
            query.message,
          );
          this.bot.sendMessage(
            query.message.chat.id,
            replaceText('💹 *Scanning Top Gainers...*'),
            { parse_mode: 'MarkdownV2' },
          );

          const cacheInsights = (await this.cacheManager.get(
            'list-gainer',
          )) as any[];

          if (cacheInsights) {
            console.log('use cache gainer insights');
            return await this.menu.insightGainers({
              bot: this.bot,
              message: query.message,
              text,
              topInsights: cacheInsights,
            });
          }

          const topInsights = await this.croData.crawGainers();
          await this.cacheManager.set(
            'list-gainer',
            topInsights.data,
            1000 * 60 * 30,
          );

          console.time('menu-gainers');
          await this.menu.insightGainers({
            bot: this.bot,
            message: query.message,
            text,
            topInsights: topInsights.data,
          });
          console.timeEnd('menu-gainers');
          return 0;
        }
      } catch (error) {
        console.log('error top gainers:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 4:token-detail-insight == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data.includes('insight_token_')) {
          this.bot.sendMessage(
            query.message.chat.id,
            replaceText('💹 *Scanning data...*'),
            { parse_mode: 'MarkdownV2' },
          );

          const convertMilliseconds = (milliseconds: number) => {
            const daysInMonth = [
              31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
            ];

            let seconds = milliseconds / 1000;
            let days = Math.floor(seconds / (24 * 3600));
            seconds %= 24 * 3600;
            const hours = Math.floor(seconds / 3600);
            seconds %= 3600;
            const minutes = Math.floor(seconds / 60);

            let months = 0;
            while (days >= daysInMonth[months]) {
              days -= daysInMonth[months];
              months++;
            }

            function renderTime(time: number, key: string) {
              return `${time > 0 ? time + ' ' + key : ''}`;
            }

            return `${renderTime(months, 'months')} ${renderTime(days, 'days')} ${renderTime(hours, 'hours')} ${renderTime(minutes, 'minutes')}`;
          };
          const formatCash = (money: number) =>
            Intl.NumberFormat('en-US', {
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(money);
          const convertTypeDexUri = (
            uri: string,
            coinIn: string,
            coinOut: string,
          ) => {
            return uri
              .replace('{coinIn}', coinIn)
              .replace('{coinOut}', coinOut);
          };

          const position = query.data.split('_')[3];
          const object = query.data.split('_')[2];

          const listObject = await this.cacheManager.get(`list-${object}`);
          const pair = listObject[position];

          const pairDEX = await this.croData.pairDetail(pair.address);
          const dex = pairDEX.data.pair;

          const coin = await this.control.checkExactlyToken(
            dex.dexId !== 'cetus'
              ? dex.baseToken.address
              : this.TypeCoinTRADE.CETUS,
          );
          const balance = await getOneBalance(coin.creator);
          const date = convertMilliseconds(
            new Date().getTime() - dex.pairCreatedAt,
          );

          const { infoAccount: text } = await this.getAllInfoChat(
            query.message,
          );
          const menuText = `📜 *Name:* \`${dex.baseToken.name}\` \\(${dex.baseToken.symbol}\\)\n*Contract Address:* \`${dex.pairAddress}\`\n\n*Contract Age:* ${date} ago\n*Creator Balance:* ${balance.totalBalance} SUI \\($${formatCash(dex.fdv)}\\)\n\n💵 *Price:* $${dex.priceUsd} \\(${dex.priceChange.h24}%\\)\n\n🔎 *DETAILS*\n*Supply: ${formatCash(coin.supply)}* \n*Market Cap:* $${formatCash(dex.fdv)}\n*Volume:* $${formatCash(dex.volume.h24)}\n*Liquidity:* $${formatCash(dex.liquidity.usd)}\n\n🖥 *Open DEX:* [${pair.dex.toUpperCase()}](${convertTypeDexUri(pair.dexUri, dex.baseToken.address, dex.quoteToken.address)})\n\n🌐 *Links:* [Chart](${dex.url})`;

          this.loopRemoveMsg(query.message);

          this.bot.sendMessage(
            query.message.chat.id,
            replaceText(text + menuText),
            {
              disable_web_page_preview: true,
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🔙️ Back',
                      callback_data: `market_insight_${object}s`,
                    },
                    {
                      text: '⏪ Market menu',
                      callback_data: 'root_market_insight',
                    },
                    { text: '⏪ Main menu', callback_data: 'edit_menu' },
                  ],
                ],
              },
            },
          );
        }
      } catch (error) {
        console.log('error token detail insight:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // === I: wallet-setting === //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'wallet_setting') {
          const {
            textMessageMenu: ui_wallet_setting,
            listWalletMenu: list_wallet_setting,
          } = await this.getAllInfoChat(query.message);
          const url_ppk = this.config.getOrThrow<string>('BE_PPK_URL');

          this.bot.editMessageText(replaceText(ui_wallet_setting), {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                ...list_wallet_setting,
                [
                  {
                    text: '📩 Import Wallet',
                    callback_data: 'import_wallet',
                  },
                  {
                    text: '🛠 Create New Wallet',
                    callback_data: 'create_wallet',
                  },
                ],
                [
                  {
                    text: '🔍 Check history activities',
                    callback_data: 'history_activities',
                  },
                  {
                    text: 'Show Private Key',
                    web_app: {
                      url: `${url_ppk}/?id=${query.message.chat.id}`,
                    },
                  },
                ],
                [
                  {
                    text: '🔙 Back',
                    callback_data: 'edit_menu',
                  },
                ],
              ],
            },
          });
          return 0;
        }
      } catch (error) {
        console.log('error wallet setting:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'check_wallet_1',
            'check_wallet_2',
            'check_wallet_3',
            'check_wallet_4',
            'check_wallet_5',
          ].includes(query.data)
        ) {
          const {
            position: position_check,
            //  wallets,
          } = await this.getAllInfoChat(query.message);

          // console.log('check wallet:', wallets[position_check - 1]);
          // const balance = await getAllBalances(
          //   wallets[position_check - 1].privateKey,
          // );
          // console.log('check balance:', balance);

          const newIndex = +query.data.split('_')[2];
          if (newIndex === position_check) return 0;

          await this.control.chainMainWallet(
            query.message.chat.id,
            position_check - 1,
            newIndex - 1,
          );

          const {
            textMessageMenu: ui_set_main,
            funcMenuWallet: list_wallet_set_main,
          } = await this.getAllInfoChat(query.message);

          this.bot.editMessageText(replaceText(ui_set_main), {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                ...list_wallet_set_main(newIndex, 'check'),
                [
                  {
                    text: '📩 Import Wallet',
                    callback_data: 'import_wallet',
                  },
                  {
                    text: '🛠 Create New Wallet',
                    callback_data: 'create_wallet',
                  },
                ],
                [
                  {
                    text: '🔍 Check history activities',
                    callback_data: 'history_activities',
                  },
                  {
                    text: 'Show Private Key',
                    web_app: {
                      url: `https://cenbot-private.netlify.app/?id=${query.message.chat.id}`,
                    },
                  },
                ],
                [
                  {
                    text: '🔙 Back',
                    callback_data: 'edit_menu',
                  },
                ],
              ],
            },
          });
          return 0;
        }
      } catch (error) {
        console.log('error check wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 0: show activities == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'history_activities') {
          const { infoAccount: infoAccActivities, wallets } =
            await this.getAllInfoChat(query.message);

          const convertTextActivity = () => {
            return (
              '═══ Activities ═══\n' +
              wallets
                .map((item) => ({
                  link: `https://suiexplorer.com/address/${item.address}`,
                  address: item.address,
                  balance: item.balance,
                  price: formatPrice(+item.balance * +this.InfoSUI.PRICE),
                  main: item.main,
                  activityText: `suiscan.xyz/mainnet/account/${item.address.slice(0, 7) + '...' + item.address.slice(-5)}/activity`,
                  activityLink: `https://suiscan.xyz/mainnet/account/${item.address}/activity`,
                }))
                .map(
                  (item, idx) =>
                    `▰ [Wallet-w${idx + 1}](${item.link}) ▰ ${item.main ? '✅' : ''}\n*Balance*: \`${item.balance} SUI\` \\($${item.price}\\)\n\`${item.address}\`\n*Activities*: [${item.activityText}](${item.activityLink})\n\n`,
                )
                .join('')
            );
          };

          await this.bot.sendMessage(
            query.message.chat.id,
            replaceText(infoAccActivities + convertTextActivity()),
            {
              disable_web_page_preview: true,
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✖️ Close', callback_data: 'close_current' }],
                ],
              },
            },
          );
          return 0;
        }
      } catch (error) {
        console.log('error history activity:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 1: import-wallet == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'import_wallet') {
          const {
            infoAccount: infoAccWalletImport,
            funcMenuWallet: list_menu_wallet_import,
          } = await this.getAllInfoChat(query.message);
          this.ActionsWALLET.IMPORT[query.message.chat.id] = 'replace_wallet_1';

          this.bot
            .sendMessage(
              query.message.chat.id,
              replaceText(
                infoAccWalletImport +
                  '🔧 *Import Wallet* ⚙\n⬩Which wallet do you want to import.️\n\n⚠️ Warning: Replaced wallets cannot be recovered.',
              ),
              {
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true,
                reply_markup: {
                  inline_keyboard: [
                    ...list_menu_wallet_import(1, 'replace'),
                    [{ text: '✖️ Close', callback_data: 'close_current' }],
                  ],
                },
              },
            )
            .finally(() => {
              // this.ActionsSWAP.REPLY[query.message.chat.id] = true;
              this.bot.sendMessage(
                query.message.chat.id,
                '🛠 Enter the private key for the custom wallet address',
                {
                  reply_markup: { force_reply: true },
                },
              );
            });

          return 0;
        }
      } catch (error) {
        console.log('error import wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'replace_wallet_1',
            'replace_wallet_2',
            'replace_wallet_3',
            'replace_wallet_4',
            'replace_wallet_5',
          ].includes(query.data)
        ) {
          this.ActionsWALLET.IMPORT[query.message.chat.id] = query.data;
          const indexCheck = +query.data.split('_')[2];

          const { infoAccount, funcMenuWallet: func_replace_wallet } =
            await this.getAllInfoChat(query.message);

          this.bot.editMessageText(
            replaceText(
              infoAccount +
                '🔧 *Import Wallet* ⚙\n⬩Which wallet do you want to import.️\n\n⚠️ Warning: Replaced wallets cannot be recovered.',
            ),
            {
              chat_id: query.message.chat.id,
              message_id: query.message.message_id,
              parse_mode: 'MarkdownV2',
              disable_web_page_preview: true,
              reply_markup: {
                inline_keyboard: [
                  ...func_replace_wallet(indexCheck, 'replace'),
                  [{ text: '✖️ Close', callback_data: 'close_current' }],
                ],
              },
            },
          );
          return 0;
        }
      } catch (error) {
        console.log('error replace wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 2: create-wallet == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'create_wallet') {
          const result = await this.control.createWallet(query.message.chat.id);
          await this.bot.sendMessage(query.message.chat.id, result);
          await this.mainMenuQuest(query.message);
          return 0;
        }
      } catch (error) {
        console.log('error create wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // === II: root_transfer === //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_transfer') {
          this.ActionsTRANSFER.MODE[query.message.chat.id] = 'SUI';
          this.ActionsTRANSFER.FROM[query.message.chat.id] =
            'transfer_from_wallet_1';
          this.ActionsTRANSFER.TO[query.message.chat.id] =
            'transfer_to_wallet_2';
          this.ActionsTRANSFER.PERCENT[query.message.chat.id] =
            'transfer_percent_0.25';
          this.ActionsTRANSFER.AMOUNT[query.message.chat.id] =
            'transfer_amount_0.1';
          this.ActionsTRANSFER.TOKEN[query.message.chat.id] =
            'transfer_sui_tokens';

          this.ActionsTRANSFER.CUSTOM[query.message.chat.id] = '';
          this.ActionsTRANSFER.WALLET_TO[query.message.chat.id] = '';

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];
          const total = list_wallet_transfers[+indexFrom - 1]?.['balance'] || 0;

          await this.menu.transferSUI({
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            total: Number(total),
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
          });
          return 0;
        }
      } catch (error) {
        console.log('error root transfer:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 1. transfer sui == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'transfer_sui') {
          this.ActionsTRANSFER.MODE[query.message.chat.id] = 'SUI';
          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];
          const total = list_wallet_transfers[+indexFrom - 1]?.['balance'] || 0;

          await this.menu.transferSUI({
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            total: Number(total),
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer sui:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'transfer_amount_0.1',
            'transfer_amount_0.3',
            'transfer_amount_0.5',
          ].includes(query.data) &&
          this.ActionsTRANSFER.MODE[query.message.chat.id] === 'SUI'
        ) {
          this.ActionsTRANSFER.AMOUNT[query.message.chat.id] = query.data;
          this.ActionsTRANSFER.CUSTOM[query.message.chat.id] = '';

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];
          const total = list_wallet_transfers[+indexFrom - 1]?.['balance'] || 0;

          await this.menu.transferSUI({
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            total: Number(total),
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer sui amount:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'transfer_from_wallet_1',
            'transfer_from_wallet_2',
            'transfer_from_wallet_3',
            'transfer_from_wallet_4',
            'transfer_from_wallet_5',
          ].includes(query.data) &&
          this.ActionsTRANSFER.MODE[query.message.chat.id] === 'SUI'
        ) {
          this.ActionsTRANSFER.FROM[query.message.chat.id] = query.data;

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];
          const total = list_wallet_transfers[+indexFrom - 1]?.['balance'] || 0;

          await this.menu.transferSUI({
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            total: Number(total),
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer token from wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'transfer_to_wallet_1',
            'transfer_to_wallet_2',
            'transfer_to_wallet_3',
            'transfer_to_wallet_4',
            'transfer_to_wallet_5',
          ].includes(query.data) &&
          this.ActionsTRANSFER.MODE[query.message.chat.id] === 'SUI'
        ) {
          this.ActionsTRANSFER.WALLET_TO[query.message.chat.id] = '';
          this.ActionsTRANSFER.TO[query.message.chat.id] = query.data;

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];
          const total = list_wallet_transfers[+indexFrom - 1]?.['balance'] || 0;

          await this.menu.transferSUI({
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            total: Number(total),
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer sui to wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'transfer_percent_0.25',
            'transfer_percent_0.5',
            'transfer_percent_1',
          ].includes(query.data) &&
          this.ActionsTRANSFER.MODE[query.message.chat.id] === 'SUI'
        ) {
          this.ActionsTRANSFER.PERCENT[query.message.chat.id] = query.data;

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];
          const total = list_wallet_transfers[+indexFrom - 1]?.['balance'] || 0;

          await this.menu.transferSUI({
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            total: Number(total),
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer sui percent:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 2. transfer token == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'transfer_token') {
          this.ActionsTRANSFER.MODE[query.message.chat.id] = 'TOKEN';
          this.ActionsTRANSFER.TOKEN[query.message.chat.id] =
            'transfer_sui_tokens';

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];

          await this.menu.transferTOKEN({
            wallets: list_wallet_transfers,
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            PERCENT: this.ActionsTRANSFER.PERCENT[query.message.chat.id],
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
            TOKEN: this.ActionsTRANSFER.TOKEN[query.message.chat.id],
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer token:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'transfer_amount_0.1',
            'transfer_amount_0.3',
            'transfer_amount_0.5',
          ].includes(query.data) &&
          this.ActionsTRANSFER.MODE[query.message.chat.id] === 'TOKEN'
        ) {
          this.ActionsTRANSFER.AMOUNT[query.message.chat.id] = query.data;
          this.ActionsTRANSFER.CUSTOM[query.message.chat.id] = '';

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];

          await this.menu.transferTOKEN({
            wallets: list_wallet_transfers,
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            PERCENT: this.ActionsTRANSFER.PERCENT[query.message.chat.id],
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
            TOKEN: this.ActionsTRANSFER.TOKEN[query.message.chat.id],
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer token amount:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'transfer_from_wallet_1',
            'transfer_from_wallet_2',
            'transfer_from_wallet_3',
            'transfer_from_wallet_4',
            'transfer_from_wallet_5',
          ].includes(query.data) &&
          this.ActionsTRANSFER.MODE[query.message.chat.id] === 'TOKEN'
        ) {
          this.ActionsTRANSFER.FROM[query.message.chat.id] = query.data;

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];

          await this.menu.transferTOKEN({
            wallets: list_wallet_transfers,
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            PERCENT: this.ActionsTRANSFER.PERCENT[query.message.chat.id],
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
            TOKEN: this.ActionsTRANSFER.TOKEN[query.message.chat.id],
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer token from wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'transfer_to_wallet_1',
            'transfer_to_wallet_2',
            'transfer_to_wallet_3',
            'transfer_to_wallet_4',
            'transfer_to_wallet_5',
          ].includes(query.data) &&
          this.ActionsTRANSFER.MODE[query.message.chat.id] === 'TOKEN'
        ) {
          this.ActionsTRANSFER.WALLET_TO[query.message.chat.id] = '';
          this.ActionsTRANSFER.TO[query.message.chat.id] = query.data;

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];

          await this.menu.transferTOKEN({
            wallets: list_wallet_transfers,
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            PERCENT: this.ActionsTRANSFER.PERCENT[query.message.chat.id],
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
            TOKEN: this.ActionsTRANSFER.TOKEN[query.message.chat.id],
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer token to wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'transfer_percent_0.25',
            'transfer_percent_0.5',
            'transfer_percent_1',
          ].includes(query.data) &&
          this.ActionsTRANSFER.MODE[query.message.chat.id] === 'TOKEN'
        ) {
          this.ActionsTRANSFER.PERCENT[query.message.chat.id] = query.data;

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];
          // const total = list_wallet_transfers[+indexFrom - 1]?.['balance'] || 0;

          await this.menu.transferTOKEN({
            wallets: list_wallet_transfers,
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            PERCENT: this.ActionsTRANSFER.PERCENT[query.message.chat.id],
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
            TOKEN: this.ActionsTRANSFER.TOKEN[query.message.chat.id],
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer token percent:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'transfer_sui_tokens',
            'transfer_usdc_tokens',
            'transfer_cetus_tokens',
            'transfer_turbos_tokens',
            'transfer_suip_tokens',
            'transfer_scb_tokens',
            'transfer_fud_tokens',
            'transfer_suia_tokens',
            'transfer_spt_tokens',
            'transfer_uni_tokens',
            'transfer_xui_tokens',
            'transfer_flx_tokens',
            'transfer_move_tokens',
            'transfer_reap_tokens',
            'transfer_spede_tokens',
            'transfer_sswp_tokens',
            'transfer_bswt_tokens',
          ].includes(query.data) &&
          this.ActionsTRANSFER.MODE[query.message.chat.id] === 'TOKEN'
        ) {
          this.ActionsTRANSFER.TOKEN[query.message.chat.id] = query.data;

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(query.message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.TO[query.message.chat.id].split('_')[3];

          await this.menu.transferTOKEN({
            wallets: list_wallet_transfers,
            bot: this.bot,
            text: menu_transfer_wallet,
            message: query.message,
            function: func_root_transfer_wallet,
            indexFrom: Number(indexFrom),
            indexTo: Number(indexTo),
            PERCENT: this.ActionsTRANSFER.PERCENT[query.message.chat.id],
            AMOUNT: this.ActionsTRANSFER.AMOUNT[query.message.chat.id],
            TOKEN: this.ActionsTRANSFER.TOKEN[query.message.chat.id],
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error transfer token type:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'transfer_set_amount') {
          this.bot.sendMessage(
            query.message.chat.id,
            '🛠 Enter the custom amount you want to transfer:',
            { reply_markup: { force_reply: true } },
          );
          return 0;
        }
      } catch (error) {
        console.log('error transfer set amount:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'transfer_custom_wallet') {
          this.bot.sendMessage(
            query.message.chat.id,
            '🛠 Enter the custom wallet you want to transfer:',
            { reply_markup: { force_reply: true } },
          );
          return 0;
        }
      } catch (error) {
        console.log('error transfer custom wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'transfer_sui_stx') {
          const { wallets, user } = await this.getAllInfoChat(query.message);
          console.log({ actions: this.ActionsTRANSFER });

          const amountAmount =
            this.ActionsTRANSFER.CUSTOM[query.message.chat.id] === ''
              ? this.ActionsTRANSFER.AMOUNT[query.message.chat.id].split('_')[2]
              : this.ActionsTRANSFER.CUSTOM[query.message.chat.id];

          const amount_sui = +amountAmount * Math.pow(10, 9);
          const privateKey =
            wallets[
              +this.ActionsTRANSFER.FROM[query.message.chat.id].charAt(
                this.ActionsTRANSFER.FROM[query.message.chat.id].length - 1,
              ) - 1
            ].privateKey;
          const address = this.ActionsTRANSFER.WALLET_TO[query.message.chat.id]
            ? this.ActionsTRANSFER.WALLET_TO[query.message.chat.id]
            : wallets[
                +this.ActionsTRANSFER.TO[query.message.chat.id].charAt(
                  this.ActionsTRANSFER.TO[query.message.chat.id].length - 1,
                ) - 1
              ].address;

          const target_sui = await getCoinBalance(
            privateKey,
            this.TypeCoinTRADE.SUI,
          );

          if (!target_sui) {
            await this.bot
              .deleteMessage(query.message.chat.id, query.message.message_id)
              .finally(() => {
                this.bot.sendMessage(
                  query.message.chat.id,
                  replaceText('⚠️ *Transfer SUI failed*!'),
                  { parse_mode: 'MarkdownV2' },
                );
                this.updateMenuQuest(query.message.chat.id);
              });
            return 0;
          }
          if (+target_sui.totalBalance < amount_sui) {
            await this.bot
              .deleteMessage(query.message.chat.id, query.message.message_id)
              .finally(() => {
                this.bot.sendMessage(
                  query.message.chat.id,
                  replaceTextItalic(
                    `⚠️ _Invalid SUI amount. Your wallet balance of .${+target_sui.totalBalance / Math.pow(10, target_sui.del)}_ !`,
                  ),
                  { parse_mode: 'MarkdownV2' },
                );
                this.updateMenuQuest(query.message.chat.id);
              });
            return 0;
          }

          console.log({ amount_sui, address, privateKey });
          const txn_sui = await transferCoin(
            '0x2::sui::SUI',
            amount_sui.toString(),
            address, // address to
            privateKey, // private`key from
          );
          console.log(`\ntransaction:`, txn_sui);
          if (txn_sui.effects.status.status === 'failure') {
            this.bot
              .deleteMessage(query.message.chat.id, query.message.message_id)
              .finally(() => {
                this.bot.sendMessage(
                  query.message.chat.id,
                  replaceText(
                    `⚠️ *Transfer SUI failed*!\nHash: \`${txn_sui.digest}\``,
                  ),
                  { parse_mode: 'MarkdownV2' },
                );
                this.updateMenuQuest(query.message.chat.id);
              });
            return 0;
          }

          await this.bot
            .deleteMessage(query.message.chat.id, query.message.message_id)
            .finally(() => {
              this.bot.sendMessage(
                query.message.chat.id,
                replaceText(
                  `✅ *Transfer SUI successful*!\nHash: \`${txn_sui.digest}\``,
                ),
                { parse_mode: 'MarkdownV2' },
              );
              this.updateMenuQuest(query.message.chat.id);
            });

          const data_sui = {
            from: privateKey,
            to: address,
            type: TransactionType.TRANSFER,
            hash: txn_sui.digest,
            tokenType:
              this.TypeCoinTRADE[
                this.ActionsTRANSFER.MODE[query.message.chat.id]
              ],
            tokenAmount: amount_sui,
            tokenPrice: +this.InfoSUI.PRICE,
            status: txn_sui.effects.status.status,
            params: '',
            scan: false,
          };
          const transferPlusSui = (+amountAmount * +this.InfoSUI.PRICE).toFixed(
            4,
          );
          console.log({ 'transfer sui plus:': transferPlusSui });

          await Promise.all([
            this.control.createTransaction(data_sui),
            this.control.plusTransferForUser(
              { userId: user._id },
              +transferPlusSui,
            ),
          ]);

          return 0;
        }
      } catch (error) {
        console.log('error transfer sui stx:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              '⚠️ *Transfer SUI failed*!',
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'transfer_tokens_stx') {
          const { wallets, user } = await this.getAllInfoChat(query.message);
          console.log({ actions: this.ActionsTRANSFER });

          const amountPercent =
            this.ActionsTRANSFER.PERCENT[query.message.chat.id].split('_')[2];
          const tokenType =
            this.TypeCoinTRADE[
              this.ActionsTRANSFER.TOKEN[query.message.chat.id]
                .split('_')[1]
                .toUpperCase()
            ];

          const walletFrom =
            wallets[
              +this.ActionsTRANSFER.FROM[query.message.chat.id].split('_')[3] -
                1
            ];
          const walletTo =
            this.ActionsTRANSFER.WALLET_TO[query.message.chat.id] === ''
              ? wallets[
                  +this.ActionsTRANSFER.TO[query.message.chat.id].split(
                    '_',
                  )[3] - 1
                ].address
              : this.ActionsTRANSFER.WALLET_TO[query.message.chat.id];

          const coin = await getCoinBalance(walletFrom.privateKey, tokenType);
          if (!coin || !coin.totalBalance) {
            this.bot
              .deleteMessage(query.message.chat.id, query.message.message_id)
              .finally(() => {
                this.bot.sendMessage(
                  query.message.chat.id,
                  '⚠️ *Token not found*!',
                  { parse_mode: 'MarkdownV2' },
                );
                this.updateMenuQuest(query.message.chat.id);
              });
            return 0;
          }

          const amount_token = Math.floor(+amountPercent * +coin.totalBalance);
          console.log({
            tokenType,
            amount_token,
            walletTo,
            walletFrom,
          });

          const txn_token = await transferCoin(
            tokenType,
            amount_token.toString(),
            walletTo,
            walletFrom.privateKey,
          );
          console.log('\ntransaction:', txn_token);
          if (txn_token.effects.status.status === 'failure') {
            this.bot
              .deleteMessage(query.message.chat.id, query.message.message_id)
              .finally(() => {
                this.bot.sendMessage(
                  query.message.chat.id,
                  replaceText(
                    `⚠️ *Transfer TOKEN failed*!\nHash: \`${txn_token.digest}\``,
                  ),
                  { parse_mode: 'MarkdownV2' },
                );
                this.updateMenuQuest(query.message.chat.id);
              });
            return 0;
          }

          await this.bot
            .deleteMessage(query.message.chat.id, query.message.message_id)
            .finally(() => {
              this.bot.sendMessage(
                query.message.chat.id,
                replaceText(
                  `✅ *Transfer TOKEN successful*!\nHash: \`${txn_token.digest}\``,
                ),
                { parse_mode: 'MarkdownV2' },
              );
              this.updateMenuQuest(query.message.chat.id);
            });

          const data_token = {
            from: walletFrom.privateKey,
            to: walletTo,
            type: TransactionType.TRANSFER,
            hash: txn_token.digest,
            tokenType:
              this.TypeCoinTRADE[
                this.ActionsTRANSFER.MODE[query.message.chat.id]
              ],
            tokenAmount: amount_token,
            tokenPrice: +this.InfoSUI.PRICE,
            status: txn_token.effects.status.status,
            params: '',
            scan: false,
          };

          const priceOnUSD = await getPriceSui(
            this.TypeCoinTRADE[
              this.ActionsTRANSFER.MODE[query.message.chat.id]
            ],
            amount_token.toString(),
            +this.InfoSUI.PRICE,
          );

          console.log({ 'transfer token plus': priceOnUSD });

          await Promise.all([
            this.control.createTransaction(data_token),
            this.control.plusTransferForUser(
              { userId: user._id },
              +priceOnUSD.toFixed(4),
            ),
          ]);

          return 0;
        }
      } catch (error) {
        console.log('error transfer token stx:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              '⚠️ *Transfer TOKEN failed*!',
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // === II: root_swap === //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_swap') {
          this.ActionsSWAP.ACTION[query.message.chat.id] = 'swap_buy_token';
          this.ActionsSWAP.AMOUNT[query.message.chat.id] = 'swap_amount_0.1';
          this.ActionsSWAP.CUSTOM_AMOUNT[query.message.chat.id] = '';
          this.ActionsSWAP.CUSTOM_SLIP[query.message.chat.id] = '';
          this.ActionsSWAP.CUSTOM_TOKEN[query.message.chat.id] = '';

          this.ActionsSWAP.MODE[query.message.chat.id] = 'swap_easy_mode';
          // this.ActionsSWAP.REPLY[query.message.chat.id] = false;
          this.ActionsSWAP.SLIPPAGE[query.message.chat.id] =
            'swap_slippage_auto';
          this.ActionsSWAP.TOKEN[query.message.chat.id] = 'swap_token_sui';
          this.ActionsSWAP.TYPE[query.message.chat.id] = 'swap_sui_type';
          this.ActionsSWAP.WALLET[query.message.chat.id] = 'swap_wallet_1';

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapBUY({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap root:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 1. swap-buy == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'swap_buy_token') {
          this.ActionsSWAP.ACTION[query.message.chat.id] = 'swap_buy_token';
          this.ActionsSWAP.SLIPPAGE[query.message.chat.id] =
            'swap_slippage_auto';

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapBUY({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap-buy:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 2. swap-sell == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'swap_sell_token') {
          this.ActionsSWAP.ACTION[query.message.chat.id] = 'swap_sell_token';
          this.ActionsSWAP.SLIPPAGE[query.message.chat.id] =
            'swap_slippage_auto';

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapSELL({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return;
        }
      } catch (error) {
        console.log('error swap sell:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 3. swap-mode == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          (query.data === 'swap_easy_mode' ||
            query.data === 'swap_expert_mode') &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_buy_token'
        ) {
          if (query.data === 'swap_easy_mode') {
            this.ActionsSWAP.MODE[query.message.chat.id] = 'swap_easy_mode';
            this.ActionsSWAP.TYPE[query.message.chat.id] = 'swap_sui_type';
            this.ActionsSWAP.AMOUNT[query.message.chat.id] = 'swap_amount_0.1';
          } else {
            this.ActionsSWAP.MODE[query.message.chat.id] = 'swap_expert_mode';
            this.ActionsSWAP.AMOUNT[query.message.chat.id] = 'swap_amount_0.1';
          }

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapBUY({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap buy mode:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          (query.data === 'swap_easy_mode' ||
            query.data === 'swap_expert_mode') &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_sell_token'
        ) {
          if (query.data === 'swap_easy_mode') {
            this.ActionsSWAP.MODE[query.message.chat.id] = 'swap_easy_mode';
            this.ActionsSWAP.TYPE[query.message.chat.id] = 'swap_sui_type';
            this.ActionsSWAP.AMOUNT[query.message.chat.id] = 'swap_amount_0.1';
          } else {
            this.ActionsSWAP.MODE[query.message.chat.id] = 'swap_expert_mode';
            this.ActionsSWAP.AMOUNT[query.message.chat.id] = 'swap_amount_0.1';
          }

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapSELL({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap sell mode:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 4. swap-type == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'swap_sui_type',
            'swap_usdc_type',
            'swap_cetus_type',
            'swap_suip_type',
            'swap_turbos_type',
            'swap_scb_type',
            'swap_fud_type',
            'swap_suia_type',
            'swap_spt_type',
            'swap_uni_type',
            'swap_xui_type',
            'swap_flx_type',
            'swap_move_type',
            'swap_reap_type',
            'swap_spede_type',
            'swap_sswp_type',
            'swap_bswt_type',
          ].includes(query.data) &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_buy_token'
        ) {
          this.ActionsSWAP.TYPE[query.message.chat.id] = query.data;

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapBUY({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap buy type:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'swap_sui_type',
            'swap_usdc_type',
            'swap_cetus_type',
            'swap_suip_type',
            'swap_turbos_type',
            'swap_scb_type',
            'swap_fud_type',
            'swap_suia_type',
            'swap_spt_type',
            'swap_uni_type',
            'swap_xui_type',
            'swap_flx_type',
            'swap_move_type',
            'swap_reap_type',
            'swap_spede_type',
            'swap_sswp_type',
            'swap_bswt_type',
          ].includes(query.data) &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_sell_token'
        ) {
          this.ActionsSWAP.TYPE[query.message.chat.id] = query.data;

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapSELL({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap sell type:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 5. swap-wallet == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'swap_wallet_1',
            'swap_wallet_2',
            'swap_wallet_3',
            'swap_wallet_4',
            'swap_wallet_5',
          ].includes(query.data) &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_buy_token'
        ) {
          this.ActionsSWAP.WALLET[query.message.chat.id] = query.data;

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapBUY({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap buy wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          query.data in
            [
              'swap_wallet_1',
              'swap_wallet_2',
              'swap_wallet_3',
              'swap_wallet_4',
              'swap_wallet_5',
            ] &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_sell_token'
        ) {
          this.ActionsSWAP.WALLET[query.message.chat.id] = query.data;

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapSELL({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap sell wallet:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 6. swap-amount == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          (query.data === 'swap_amount_0.1' ||
            query.data === 'swap_amount_0.5') &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_buy_token'
        ) {
          this.ActionsSWAP.AMOUNT[query.message.chat.id] = query.data;
          this.ActionsSWAP.CUSTOM_AMOUNT[query.message.chat.id] = '';

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapBUY({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap buy amount:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          (query.data === 'swap_amount_0.1' ||
            query.data === 'swap_amount_0.5') &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_sell_token'
        ) {
          this.ActionsSWAP.AMOUNT[query.message.chat.id] = query.data;
          this.ActionsSWAP.CUSTOM_AMOUNT[query.message.chat.id] = '';

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapSELL({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap sell amount:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 7. swap-slippage == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          (query.data === 'swap_slippage_auto' ||
            query.data === 'swap_slippage_3') &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_buy_token'
        ) {
          this.ActionsSWAP.SLIPPAGE[query.message.chat.id] = query.data;
          this.ActionsSWAP.CUSTOM_SLIP[query.message.chat.id] = '';

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapBUY({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap buy slippage', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          (query.data === 'swap_slippage_auto' ||
            query.data === 'swap_slippage_3') &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_sell_token'
        ) {
          this.ActionsSWAP.SLIPPAGE[query.message.chat.id] = query.data;
          this.ActionsSWAP.CUSTOM_SLIP[query.message.chat.id] = '';

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapSELL({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap sell slippage', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 8. swap-token == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'swap_token_sui',
            'swap_token_usdc',
            'swap_token_cetus',
            'swap_token_suip',
            'swap_token_turbos',
            'swap_token_scb',
            'swap_token_fud',
            'swap_token_suia',
            'swap_token_spt',
            'swap_token_uni',
            'swap_token_xui',
            'swap_token_flx',
            'swap_token_move',
            'swap_token_reap',
            'swap_token_spede',
            'swap_token_sswp',
            'swap_token_bswt',
          ].includes(query.data) &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_buy_token'
        ) {
          this.ActionsSWAP.TOKEN[query.message.chat.id] = query.data;
          this.ActionsSWAP.CUSTOM_TOKEN[query.message.chat.id] = '';
          console.log('vao swap buy tok');

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapBUY({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP,
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap buy token type:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          [
            'swap_token_sui',
            'swap_token_usdc',
            'swap_token_cetus',
            'swap_token_suip',
            'swap_token_turbos',
            'swap_token_scb',
            'swap_token_fud',
            'swap_token_suia',
            'swap_token_spt',
            'swap_token_uni',
            'swap_token_xui',
            'swap_token_flx',
            'swap_token_move',
            'swap_token_reap',
            'swap_token_spede',
            'swap_token_sswp',
            'swap_token_bswt',
          ].includes(query.data) &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_sell_token'
        ) {
          this.ActionsSWAP.TOKEN[query.message.chat.id] = query.data;
          this.ActionsSWAP.CUSTOM_TOKEN[query.message.chat.id] = '';

          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(query.message);

          await this.menu.swapSELL({
            wallets: wallets_swap,
            bot: this.bot,
            text: information_swap,
            message: query.message,
            function: func_menu_wallet_swap,
            ActionsSWAP: this.ActionsSWAP[query.message.chat.id],
            TYPE_COIN: this.TypeCoinTRADE,
          });
          return 0;
        }
      } catch (error) {
        console.log('error swap sell token type:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'swap_amount_custom') {
          this.bot.sendMessage(
            query.message.chat.id,
            '🛠 Enter the custom amount you want to swap:',
            { reply_markup: { force_reply: true } },
          );
          return 0;
        }
      } catch (error) {
        console.log('error enter custom amount:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'swap_slippage_custom') {
          this.bot.sendMessage(
            query.message.chat.id,
            '🛠 Enter the custom slippage you want to swap:',
            { reply_markup: { force_reply: true } },
          );
          return 0;
        }
      } catch (error) {
        console.log('error custom slippage:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'swap_custom_token') {
          this.bot.sendMessage(
            query.message.chat.id,
            '🛠 Enter the custom token you want to swap:',
            { reply_markup: { force_reply: true } },
          );
          return 0;
        }
      } catch (error) {
        console.log('error custom token:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 10. swap-buy-transaction == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          query.data === 'swap_send_transaction' &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_buy_token'
        ) {
          console.log('vao buy roi');

          const amount_convert_swap =
            this.ActionsSWAP.CUSTOM_AMOUNT[query.message.chat.id] === ''
              ? this.ActionsSWAP.AMOUNT[query.message.chat.id].split('_')[2]
              : this.ActionsSWAP.CUSTOM_AMOUNT[query.message.chat.id];
          const slippage =
            this.ActionsSWAP.CUSTOM_SLIP[query.message.chat.id] === ''
              ? this.ActionsSWAP.SLIPPAGE[query.message.chat.id].split('_')[2]
              : this.ActionsSWAP.CUSTOM_SLIP[query.message.chat.id];

          const swap_type = this.ActionsSWAP.TYPE[query.message.chat.id]
            .split('_')[1]
            .toUpperCase();
          const type_coin = this.TypeCoinTRADE[swap_type];

          const { wallets, user } = await this.getAllInfoChat(query.message);

          const wallet_choose_swap =
            wallets[
              +this.ActionsSWAP.WALLET[query.message.chat.id].split('_')[2] - 1
            ];

          const info_coin = await getBalanceMeta(type_coin);
          const token_type =
            this.TypeCoinTRADE[
              this.ActionsSWAP.TOKEN[query.message.chat.id]
                .split('_')[2]
                .toUpperCase()
            ];
          const swap_amount =
            +amount_convert_swap * Math.pow(10, info_coin.decimals);
          const slippageCheck = slippage === 'auto' ? null : +slippage / 100;

          const target_coin = await getCoinBalance(
            wallet_choose_swap.privateKey,
            type_coin,
          );
          console.log({
            type_coin,
            token_type,
            swap_amount,
            target_coin,
            slippageCheck,
          });

          if (+target_coin.totalBalance < swap_amount) {
            await this.bot
              .deleteMessage(query.message.chat.id, query.message.message_id)
              .finally(() => {
                this.bot.sendMessage(
                  query.message.chat.id,
                  replaceTextItalic(
                    `⚠️ _Invalid ${swap_type} amount. Your wallet balance of .${+target_coin.totalBalance / Math.pow(10, target_coin.del)}_ !`,
                  ),
                  { parse_mode: 'MarkdownV2' },
                );
                this.updateMenuQuest(query.message.chat.id);
              });
            return 0;
          }

          const swap_create_txn = await trade(
            type_coin,
            token_type,
            swap_amount.toString(),
            wallet_choose_swap.privateKey,
            slippageCheck,
          );
          if (swap_create_txn.effects.status.status === 'failure') {
            await this.bot
              .deleteMessage(query.message.chat.id, query.message.message_id)
              .finally(() => {
                this.bot.sendMessage(
                  query.message.chat.id,
                  '⚠️ *Swap failed*!',
                  { parse_mode: 'MarkdownV2' },
                );
                this.updateMenuQuest(query.message.chat.id);
              });
            return 0;
          }
          console.log('buy-transaction:', swap_create_txn);

          await this.bot
            .deleteMessage(query.message.chat.id, query.message.message_id)
            .finally(async () => {
              await this.bot.sendMessage(
                query.message.chat.id,
                replaceText(
                  `✅ *Swap successful*!\nHash: ${swap_create_txn.digest}`,
                ),
                { parse_mode: 'MarkdownV2' },
              );
              await this.updateMenuQuest(query.message.chat.id);
            });

          const swap_create_data = {
            from: wallet_choose_swap.privateKey,
            to: '',
            type: TransactionType.BUY,
            hash: swap_create_txn.digest,
            tokenType: type_coin,
            tokenAmount: swap_amount,
            tokenPrice: +this.InfoSUI.PRICE,
            status: swap_create_txn.effects.status.status,
            params: '',
            scan: false,
          };

          const priceOnUSD = await getPriceSui(
            type_coin,
            swap_amount.toString(),
            +this.InfoSUI.PRICE,
          );

          await Promise.all([
            this.control.createTransaction(swap_create_data),
            this.control.plusSwapForUser(
              { userId: user._id },
              +priceOnUSD.toFixed(4),
            ),
          ]);

          this.ActionsSWAP = {
            ACTION: { [query.message.chat.id]: 'swap_buy_token' },
            MODE: { [query.message.chat.id]: 'swap_easy_mode' },
            REPLY: { [query.message.chat.id]: false },
            WALLET: { [query.message.chat.id]: 'swap_wallet_1' },
            TYPE: { [query.message.chat.id]: 'swap_sui_type' },
            AMOUNT: { [query.message.chat.id]: 'swap_amount_0.1' },
            SLIPPAGE: { [query.message.chat.id]: 'swap_slippage_auto' },
            CUSTOM_AMOUNT: { [query.message.chat.id]: '' },
            CUSTOM_SLIP: { [query.message.chat.id]: '' },
            CUSTOM_TOKEN: { [query.message.chat.id]: '' },
            TOKEN: { [query.message.chat.id]: 'swap_token_sui' },
          };

          return 0;
        }
      } catch (error) {
        console.log('error swap buy transaction:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(query.message.chat.id, '⚠️ *Swap failed*!', {
              parse_mode: 'MarkdownV2',
            });
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // == 11. swap-sell-transaction == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (
          query.data === 'swap_send_transaction' &&
          this.ActionsSWAP.ACTION[query.message.chat.id] === 'swap_sell_token'
        ) {
          const amount_convert_swap =
            this.ActionsSWAP.CUSTOM_AMOUNT[query.message.chat.id] === ''
              ? this.ActionsSWAP.AMOUNT[query.message.chat.id].split('_')[2]
              : this.ActionsSWAP.CUSTOM_AMOUNT[query.message.chat.id];
          const slippage =
            this.ActionsSWAP.CUSTOM_SLIP[query.message.chat.id] === ''
              ? this.ActionsSWAP.SLIPPAGE[query.message.chat.id].split('_')[2]
              : this.ActionsSWAP.CUSTOM_SLIP[query.message.chat.id];

          const swap_type = this.ActionsSWAP.TYPE[query.message.chat.id]
            .split('_')[1]
            .toUpperCase();
          const type_coin = this.TypeCoinTRADE[swap_type];

          const { wallets, user } = await this.getAllInfoChat(query.message);

          const wallet_choose_swap =
            wallets[
              +this.ActionsSWAP.WALLET[query.message.chat.id].split('_')[2] - 1
            ];

          const info_coin = await getBalanceMeta(type_coin);
          const token_type =
            this.TypeCoinTRADE[
              this.ActionsSWAP.TOKEN[query.message.chat.id]
                .split('_')[2]
                .toUpperCase()
            ];
          const swap_amount =
            +amount_convert_swap * Math.pow(10, info_coin.decimals);
          const slippageCheck = slippage === 'auto' ? null : +slippage / 100;

          const target_coin = await getCoinBalance(
            wallet_choose_swap.privateKey,
            type_coin,
          );

          if (+target_coin.totalBalance < swap_amount) {
            await this.bot
              .deleteMessage(query.message.chat.id, query.message.message_id)
              .finally(() => {
                this.bot.sendMessage(
                  query.message.chat.id,
                  replaceTextItalic(
                    `⚠️ _Invalid ${swap_type} amount. Your wallet balance of .${+target_coin.totalBalance / Math.pow(10, target_coin.del)}_ !`,
                  ),
                  { parse_mode: 'MarkdownV2' },
                );
                this.updateMenuQuest(query.message.chat.id);
              });
            return 0;
          }

          const swap_create_txn = await trade(
            type_coin, // ra
            token_type, // vao
            swap_amount.toString(),
            wallet_choose_swap.privateKey,
            slippageCheck,
          );
          if (swap_create_txn.effects.status.status === 'failure') {
            this.bot
              .deleteMessage(query.message.chat.id, query.message.message_id)
              .finally(async () => {
                await this.bot.sendMessage(
                  query.message.chat.id,
                  '⚠️ *Swap failed*!',
                  { parse_mode: 'MarkdownV2' },
                );
                await this.updateMenuQuest(query.message.chat.id);
              });
            return 0;
          }

          await this.bot
            .deleteMessage(query.message.chat.id, query.message.message_id)
            .finally(async () => {
              await this.bot.sendMessage(
                query.message.chat.id,
                replaceText(
                  `✅ *Swap successful*!\nHash: ${swap_create_txn.digest}`,
                ),
                { parse_mode: 'MarkdownV2' },
              );
              await this.updateMenuQuest(query.message.chat.id);
            });

          const swap_create_data = {
            from: wallet_choose_swap.privateKey,
            to: '',
            type: TransactionType.BUY,
            hash: swap_create_txn.digest,
            tokenType: type_coin,
            tokenAmount: swap_amount,
            tokenPrice: +this.InfoSUI.PRICE,
            status: swap_create_txn.effects.status.status,
            params: '',
            scan: false,
          };

          this.ActionsSWAP = {
            ACTION: { [query.message.chat.id]: 'swap_buy_token' },
            MODE: { [query.message.chat.id]: 'swap_easy_mode' },
            REPLY: { [query.message.chat.id]: false },
            WALLET: { [query.message.chat.id]: 'swap_wallet_1' },
            TYPE: { [query.message.chat.id]: 'swap_sui_type' },
            AMOUNT: { [query.message.chat.id]: 'swap_amount_0.1' },
            SLIPPAGE: { [query.message.chat.id]: 'swap_slippage_auto' },
            CUSTOM_AMOUNT: { [query.message.chat.id]: '' },
            CUSTOM_SLIP: { [query.message.chat.id]: '' },
            CUSTOM_TOKEN: { [query.message.chat.id]: '' },
            TOKEN: { [query.message.chat.id]: 'swap_token_sui' },
          };

          const priceOnUSD = await getPriceSui(
            type_coin,
            swap_amount.toString(),
            +this.InfoSUI.PRICE,
          );

          await Promise.all([
            this.control.createTransaction(swap_create_data),
            this.control.plusSwapForUser(
              { userId: user._id },
              +priceOnUSD.toFixed(4),
            ),
          ]);
          console.log('sell-transaction:', swap_create_txn);

          return 0;
        }
      } catch (error) {
        console.log('error swap sell transaction:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(query.message.chat.id, '⚠️ *Swap failed*!', {
              parse_mode: 'MarkdownV2',
            });
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // === III: root-ranking === //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_ranking') {
          const { infoAccount: information_ranking } =
            await this.getAllInfoChat(query.message);
          const ranks = await this.control.getUsersRanking();
          const renderHc = (index: number) => {
            switch (index) {
              case 0:
                return '🥇 ';
              case 1:
                return '🥈 ';
              case 2:
                return '🥉 ';
              default:
                return '• ';
            }
          };

          const menuRankings = ranks
            .map(
              (item, idx) =>
                `${renderHc(idx)}Top ${idx + 1}: [@${
                  item.xUsername
                }](https://twitter.com/${item.xUsername}) | Balance: ${
                  item.point
                } xCEN`,
            )
            .join('\n');

          await this.bot.sendMessage(
            query.message.chat.id,
            replaceText(
              information_ranking + '🏆 *Top xCEN Ranking*:\n\n' + menuRankings,
            ),
            {
              disable_web_page_preview: true,
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✖️ Close', callback_data: 'close_current' }],
                ],
              },
            },
          );
          return 0;
        }
      } catch (error) {
        console.log('error root ranking:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // === IV: root-referral === //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_referral') {
          const {
            infoAccount: information_referral,
            user: user_referral,
            count: count_referrer,
          } = await this.getAllInfoChat(query.message);
          const referral_link = `${this.config.getOrThrow<string>('REFERRAL_LINK')}?start=${user_referral.code}`;

          await this.bot.sendMessage(
            query.message.chat.id,
            replaceText(
              information_referral +
                '*Invitation code*: ' +
                user_referral.code +
                '\n*Invitation link*: `' +
                referral_link +
                '`' +
                '\n\n• *Total Referral*: ' +
                count_referrer,
            ),
            {
              disable_web_page_preview: true,
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✖️ Close', callback_data: 'close_current' },
                    {
                      text: 'Explore Rank',
                      callback_data: 'root_ranking',
                    },
                  ],
                ],
              },
            },
          );
          return 0;
        }
      } catch (error) {
        console.log('error root referral:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // === V: root_social === //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_social_task') {
          const { infoAccount, textSocial } = await this.getAllInfoChat(
            query.message,
          );

          this.bot.editMessageText(replaceText(infoAccount + textSocial), {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            disable_web_page_preview: true,
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Follow @CenBot_org',
                    callback_data: 'social_follow_page',
                  },
                ],
                [
                  {
                    text: 'Repost this post',
                    callback_data: 'social_retweet_post',
                  },
                  {
                    text: 'Like this post',
                    callback_data: 'social_like_post',
                  },
                ],
                [{ text: '✖️ Close', callback_data: 'edit_menu' }],
              ],
            },
          });
          return 0;
        }
      } catch (error) {
        console.log('error root social task:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 1: social_like_post == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'social_like_post') {
          await this.updateLikeChat(
            query.message.chat.id,
            query.message.message_id,
          );
        }
      } catch (error) {
        console.log('error social like post:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 2: social_retweet_port == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'social_retweet_post') {
          await this.updateRetweetChat(
            query.message.chat.id,
            query.message.message_id,
          );
        }
      } catch (error) {
        console.log('error social introduction_retweet post:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
    // == 4: social_follow_page == //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'social_follow_page') {
          await this.updateFollowChat(
            query.message.chat.id,
            query.message.message_id,
          );
        }
      } catch (error) {
        console.log('error social follow page:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // === VI: root_daily === //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_daily_task') {
          const { infoAccount: information_daily, task: user_task_daily } =
            await this.getAllInfoChat(query.message);

          const inlineMenuDaily = `📎 *Daily Task | Available List*\n• Transfer: ${user_task_daily.transfer} \n• Swap: ${user_task_daily.swap}`;

          this.bot.sendMessage(
            query.message.chat.id,
            replaceText(information_daily + inlineMenuDaily),
            {
              disable_web_page_preview: true,
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: 'Verify Transfer 🚀',
                      callback_data: 'daily_verify_transfer',
                    },
                    {
                      text: 'Verify Swap 🔁',
                      callback_data: 'daily_verify_swap',
                    },
                  ],
                  [{ text: '✖️ Close', callback_data: 'close_current' }],
                ],
              },
            },
          );
          return 0;
        }
      } catch (error) {
        console.log('error daily task:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'close_current') {
          this.bot
            .deleteMessage(query.message.chat.id, query.message.message_id)
            .catch(() => {
              return;
            });
          return 0;
        }
      } catch (error) {
        console.log('error close current:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.bot.sendMessage(
              query.message.chat.id,
              replaceTextItalic('⚠️ _Something went wrong_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'edit_menu') {
          // if (this.ActionsSWAP.REPLY) {
          //   await this.bot.deleteMessage(
          //     query.message.chat.id,
          //     query.message.message_id + 1,
          //   );
          //   this.ActionsSWAP.REPLY = false;
          //   this.bot.clearReplyListeners();
          // }
          await this.callbackMenuQuest(query.message);
          return 0;
        }
      } catch (error) {
        console.log('error edit menu:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'refresh_menu') {
          this.loopRemoveMsg(query.message);

          this.updateMenuQuest(query.message.chat.id);
          return 0;
        }
      } catch (error) {
        console.log('error refresh menu:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    // === VII: root_setting === //
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'root_setting') {
          const { infoAccount: informationSetting } = await this.getAllInfoChat(
            query.message,
          );
          await this.bot.sendMessage(
            query.message.chat.id,
            replaceText(informationSetting + '═══ *User Setting* ═══\n'),
            {
              disable_web_page_preview: true,
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: 'Update account',
                      callback_data: 'update_account',
                    },
                    {
                      text: 'Replace all wallet',
                      callback_data: 'replace_all_wallet',
                    },
                  ],
                  [{ text: '✖️ Close', callback_data: 'close_current' }],
                ],
              },
            },
          );
          return 0;
        }
      } catch (error) {
        console.log('error root setting:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'update_account') {
          const { user: user_update } = await this.getAllInfoChat(
            query.message,
          );
          const dataX = await this.taskCron.getUserDetail(user_update.xId);
          console.log({ dataX: dataX.data });

          await this.control.updateUser(
            { botId: query.message.chat.id },
            {
              username: query.message.chat.username,
              xUsername: dataX.data.username,
              xAvatar: dataX.data.profile_pic_url,
            },
          );

          this.bot
            .deleteMessage(query.message.chat.id, query.message.message_id)
            .catch(() => {
              return;
            })
            .finally(() => {
              this.bot
                .sendMessage(
                  query.message.chat.id,
                  'Updated profile successful!',
                )
                .finally(async () => {
                  this.updateMenuQuest(query.message.chat.id);
                });
            });

          return 0;
        }
      } catch (error) {
        console.log('error update account:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });

    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      try {
        if (query.data === 'replace_all_wallet') {
          await this.control.replaceAllWallet(query.message.chat.id);
          this.bot
            .deleteMessage(query.message.chat.id, query.message.message_id)
            .catch(() => {
              return;
            })
            .finally(() => {
              this.bot
                .sendMessage(
                  query.message.chat.id,
                  'Replace all wallet successful!',
                )
                .finally(async () => {
                  this.updateMenuQuest(query.message.chat.id);
                });
            });

          return 0;
        }
      } catch (error) {
        console.log('error update account:', error.message);
        this.bot
          .deleteMessage(query.message.chat.id, query.message.message_id)
          .catch(() => {
            return;
          })
          .finally(() => {
            this.updateMenuQuest(query.message.chat.id);
          });
      }
    });
  }

  async initActions() {
    const users = await this.getAllUser();
    const botIds = users.map((item) => item.botId);
    const actionsSnipe = botIds.reduce(
      (acc, curr) => {
        return {
          WALLETS: { ...acc.WALLETS, [curr]: [] }, // [],
          MAX_SPEND: { ...acc.MAX_SPEND, [curr]: '' }, // '',
          AUTO_SELL: { ...acc.AUTO_SELL, [curr]: 'OFF' }, // 'OFF',
          FIRST_FAIL: { ...acc.FIRST_FAIL, [curr]: false }, // false,
          ANTI_RUG: { ...acc.ANTI_RUG, [curr]: false }, // false,
        };
      },
      {
        WALLETS: {}, // [],
        MAX_SPEND: {}, // '',
        AUTO_SELL: {}, // 'OFF',
        FIRST_FAIL: {}, // false,
        ANTI_RUG: {}, // false,
      },
    );

    this.ActionsSNIPE = actionsSnipe;
  }

  async sendPnlSnipe(botId: number, snipeId: string, amount: string) {
    try {
      const { textInfoHtml } = await this.getAllInfoChat({
        message_id: 0,
        date: 0,
        chat: { id: botId, type: 'group' },
      });
      const snipe = await this.control.getSnipe({ _id: snipeId });
      const type = await getBalanceMeta(snipe.token);
      const priceToken = formatPrice(
        +snipe.firstPrice * (+amount / Math.pow(10, type.decimals)),
      );

      const text = `${textInfoHtml}<strong>Sniped: ${snipe.maxSpend} SUI</strong>\n<strong>Contact Address:</strong>\n<code>${snipe.token}</code>\n<strong>Balance:</strong> ${amount} ${type.symbol} - $${priceToken}\n\n<strong>Wallet:</strong> <code>${snipe.wallets[0]}</code>\n<strong>DEX:</strong> ${snipe.swapDex}\n<strong>TXID:</strong> <a href="https://suivision.xyz/txblock/${snipe.hash}">Link</a>\n<strong>Rate:</strong> ${formatPrice((+snipe.maxSpend * Math.pow(10, 9)) / +amount)} SUI / 1 ${type.symbol}`;

      this.bot.sendMessage(botId, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '✖️ Close', callback_data: 'close_current' }],
          ],
        },
      });
    } catch (error) {
      console.log('error send-pnl-snipe:', error.message);
    }
  }

  async sendImagePnl(snipeId: string, path: string) {
    try {
      const url = this.config.getOrThrow<string>('AWS_S3_URI');
      const uri = `${url}/${path}`;
      const snipe = await this.control.getAllSnipe({ _id: snipeId });
      this.bot.sendPhoto(snipe[0].userId.botId, uri);
    } catch (error) {
      console.log('error send image pnl:', error.message);
    }
  }

  async sendMessageAntiRug(token: string) {
    try {
      const snipes = await this.control.getAllSnipe({ token });

      await Promise.all(
        snipes.map(async (item) => {
          const { infoAccount } = await this.getAllInfoChat({
            message_id: 0,
            date: 0,
            chat: { id: item.userId.botId, type: 'group' },
          });
          const text = `${infoAccount}*Anti-Rug:* \`${item.token}\``;

          this.bot.sendMessage(item.userId.botId, replaceText(text), {
            disable_web_page_preview: true,
            parse_mode: 'MarkdownV2',
          });
        }),
      );
    } catch (error) {
      console.log('error send message anti rug:', error.message);
    }
  }

  async sendMessageAutoSell(token: string) {
    try {
      const snipes = await this.control.getAllSnipe({ token });

      await Promise.all(
        snipes.map(async (item) => {
          const { infoAccount } = await this.getAllInfoChat({
            message_id: 0,
            date: 0,
            chat: { id: item.userId.botId, type: 'group' },
          });
          const text = `${infoAccount}*Auto Sell:* \`${item.token}\``;

          this.bot.sendMessage(item.userId.botId, replaceText(text), {
            disable_web_page_preview: true,
            parse_mode: 'MarkdownV2',
          });
        }),
      );
    } catch (error) {
      console.log('error send message anti rug:', error.message);
    }
  }

  private async onReceivedMessage(message: TelegramBot.Message) {
    try {
      if (message?.reply_to_message) {
        const mess_rep = message.reply_to_message;

        if (mess_rep.text.includes('custom amount you want to transfer')) {
          this.ActionsTRANSFER.CUSTOM[message.chat.id] = message.text;

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[message.chat.id].split('_')[3];
          const indexTo =
            this.ActionsTRANSFER.WALLET_TO === ''
              ? this.ActionsTRANSFER.TO[message.chat.id].split('_')[3]
              : 0;

          const newWallet = this.ActionsTRANSFER.WALLET_TO[message.chat.id];
          const convertWallet =
            newWallet.length > 12
              ? newWallet?.slice(0, 7) + '...' + newWallet?.slice(-5)
              : '';

          await this.bot.deleteMessage(message.chat.id, message.message_id - 2);
          await this.bot.deleteMessage(message.chat.id, message.message_id - 1);
          await this.bot.deleteMessage(message.chat.id, message.message_id);

          if (this.ActionsTRANSFER.MODE[message.chat.id] === 'SUI') {
            const total =
              list_wallet_transfers[+indexFrom - 1]?.['balance'] || 0;

            await this.bot.sendMessage(
              message.chat.id,
              replaceText(menu_transfer_wallet + '💸 *Transfer SUI* 💸'),
              {
                disable_web_page_preview: true,
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '✖️ Close', callback_data: 'edit_menu' }],
                    [
                      {
                        text: 'Transfer SUI ✅',
                        callback_data: 'transfer_sui',
                      },
                      {
                        text: 'Transfer TOKEN',
                        callback_data: 'transfer_token',
                      },
                    ],
                    [
                      {
                        text: '⬜️ FROM WALLET ⬜️',
                        callback_data: 'from_wallet',
                      },
                    ],
                    ...func_root_transfer_wallet(+indexFrom, 'transfer_from'),
                    [{ text: '⬜️ TO WALLET ⬜️', callback_data: 'to_wallet' }],
                    ...func_root_transfer_wallet(+indexTo, 'transfer_to'),
                    [
                      {
                        text:
                          this.ActionsTRANSFER.WALLET_TO[message.chat.id] === ''
                            ? 'Custom Wallet: --'
                            : `✅ Custom Wallet: ${convertWallet}`,
                        callback_data: 'transfer_custom_wallet',
                      },
                    ],
                    [
                      {
                        text: '⬜️ TRANSFER AMOUNT ⬜️',
                        callback_data: 'transfer__amount',
                      },
                    ],
                    [
                      {
                        text: '0.1 SUI',
                        callback_data: 'transfer_amount_0.1',
                      },
                      {
                        text: '0.3 SUI',
                        callback_data: 'transfer_amount_0.3',
                      },
                      {
                        text: '0.5 SUI',
                        callback_data: 'transfer_amount_0.5',
                      },
                    ],
                    [
                      {
                        text: `✅ Set: ${this.ActionsTRANSFER.CUSTOM[message.chat.id]}`,
                        callback_data: 'transfer_set_amount',
                      },
                      {
                        text: `All: ${total} SUI`,
                        callback_data: 'transfer_amount_all',
                      },
                    ],

                    [
                      {
                        text: '💸 Transfer SUI (SEND TX)',
                        callback_data: 'transfer_sui_stx',
                      },
                    ],
                  ],
                },
              },
            );
          }
        }

        if (mess_rep.text.includes('custom wallet you want to transfer')) {
          this.ActionsTRANSFER.WALLET_TO[message.chat.id] = message.text;
          console.log({ trans: this.ActionsTRANSFER });

          const {
            wallets: list_wallet_transfers,
            textMessageMenu: menu_transfer_wallet,
            funcMenuWallet: func_root_transfer_wallet,
          } = await this.getAllInfoChat(message);

          const indexFrom =
            this.ActionsTRANSFER.FROM[message.chat.id].split('_')[3];
          const total = list_wallet_transfers[+indexFrom - 1]?.['balance'] || 0;

          const wallet_choose = list_wallet_transfers[+indexFrom - 1];
          const coins = await getAllBalances(wallet_choose.privateKey);
          const list_token_transfer = [];
          let menuListToken = '';

          for (const [key, value] of Object.entries(this.TypeCoinTRADE)) {
            const coin = coins.find((co) => co?.coinType === value);

            if (coin) {
              const amount = (
                +coin.totalBalance / Math.pow(10, coin.del)
              ).toFixed(4);
              menuListToken += `\n• *${key}*: \`${amount}\``;
              list_token_transfer.push({
                text:
                  (this.ActionsTRANSFER.TOKEN[message.chat.id]?.includes(
                    key.toLowerCase(),
                  )
                    ? '✅ '
                    : '') + key,
                callback_data: `transfer_${key.toLowerCase()}_tokens`,
              });
            }
          }
          const newWallet = this.ActionsTRANSFER.WALLET_TO[message.chat.id];
          const convertWallet =
            newWallet?.slice(0, 7) + '...' + newWallet?.slice(-5);

          await this.bot.deleteMessage(message.chat.id, message.message_id - 2);
          await this.bot.deleteMessage(message.chat.id, message.message_id - 1);
          await this.bot.deleteMessage(message.chat.id, message.message_id);

          if (this.ActionsTRANSFER.MODE[message.chat.id] === 'SUI') {
            this.bot.sendMessage(
              message.chat.id,
              replaceText(menu_transfer_wallet + '💸 *Transfer SUI* 💸'),
              {
                disable_web_page_preview: true,
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '✖️ Close', callback_data: 'edit_menu' }],
                    [
                      {
                        text: 'Transfer SUI ✅',
                        callback_data: 'transfer_sui',
                      },
                      {
                        text: 'Transfer TOKEN',
                        callback_data: 'transfer_token',
                      },
                    ],
                    [
                      {
                        text: '⬜️ FROM WALLET ⬜️',
                        callback_data: 'from_wallet',
                      },
                    ],
                    ...func_root_transfer_wallet(+indexFrom, 'transfer_from'),
                    [
                      {
                        text: '⬜️ TO WALLET ⬜️',
                        callback_data: 'to_wallet',
                      },
                    ],
                    ...func_root_transfer_wallet(0, 'transfer_to'),
                    [
                      {
                        text: `✅ Custom Wallet: ${convertWallet}`,
                        callback_data: 'transfer_custom_wallet',
                      },
                    ],
                    [
                      {
                        text: '⬜️ TRANSFER AMOUNT ⬜️',
                        callback_data: 'transfer__amount',
                      },
                    ],
                    [
                      {
                        text:
                          (this.ActionsTRANSFER.AMOUNT[
                            message.chat.id
                          ]?.includes('0.1') &&
                          this.ActionsTRANSFER.CUSTOM[message.chat.id] === ''
                            ? '✅ '
                            : '') + '0.1 SUI',
                        callback_data: 'transfer_amount_0.1',
                      },
                      {
                        text:
                          (this.ActionsTRANSFER.AMOUNT[
                            message.chat.id
                          ]?.includes('0.3') &&
                          this.ActionsTRANSFER.CUSTOM[message.chat.id] === ''
                            ? '✅ '
                            : '') + '0.3 SUI',
                        callback_data: 'transfer_amount_0.3',
                      },
                      {
                        text:
                          (this.ActionsTRANSFER.AMOUNT[
                            message.chat.id
                          ]?.includes('0.5') &&
                          this.ActionsTRANSFER.CUSTOM[message.chat.id] === ''
                            ? '✅ '
                            : '') + '0.5 SUI',
                        callback_data: 'transfer_amount_0.5',
                      },
                    ],
                    [
                      {
                        text: `${this.ActionsTRANSFER.CUSTOM[message.chat.id] === '' ? 'Set: --' : '✅ Set: ' + this.ActionsTRANSFER.CUSTOM[message.chat.id]}`,
                        callback_data: 'transfer_set_amount',
                      },
                      {
                        text:
                          (this.ActionsTRANSFER.AMOUNT[
                            message.chat.id
                          ]?.includes('all')
                            ? '✅ '
                            : '') + `All: ${total} SUI`,
                        callback_data: 'transfer_amount_all',
                      },
                    ],

                    [
                      {
                        text: '💸 Transfer SUI (SEND TX)',
                        callback_data: 'transfer_sui_stx',
                      },
                    ],
                  ],
                },
              },
            );
          }

          if (this.ActionsTRANSFER.MODE[message.chat.id] === 'TOKEN') {
            this.bot.sendMessage(
              message.chat.id,
              replaceText(
                menu_transfer_wallet + '💸 *Transfer TOKEN* 💸' + menuListToken,
              ),
              {
                disable_web_page_preview: true,
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '✖️ Close', callback_data: 'edit_menu' }],
                    [
                      {
                        text: 'Transfer SUI',
                        callback_data: 'transfer_sui',
                      },
                      {
                        text: 'Transfer TOKEN ✅',
                        callback_data: 'transfer_token',
                      },
                    ],
                    [
                      {
                        text: '⬜️ FROM WALLET ⬜️',
                        callback_data: 'from_wallet',
                      },
                    ],
                    ...func_root_transfer_wallet(+indexFrom, 'transfer_from'),
                    [{ text: '⬜️ TO WALLET ⬜️', callback_data: 'to_wallet' }],
                    ...func_root_transfer_wallet(0, 'transfer_to'),
                    [
                      {
                        text: `✅ Custom Wallet: ${convertWallet}`,
                        callback_data: 'transfer_custom_wallet',
                      },
                    ],
                    [
                      {
                        text: '⬜️ TRANSFER PERCENT ⬜️',
                        callback_data: 'switch_percent',
                      },
                    ],
                    [
                      {
                        text:
                          '25%' +
                          (this.ActionsTRANSFER.PERCENT[
                            message.chat.id
                          ]?.includes('percent_0.25')
                            ? ' ✅'
                            : ''),
                        callback_data: 'transfer_percent_0.25',
                      },
                      {
                        text:
                          '50%' +
                          (this.ActionsTRANSFER.PERCENT[
                            message.chat.id
                          ]?.includes('percent_0.5')
                            ? ' ✅'
                            : ''),
                        callback_data: 'transfer_percent_0.5',
                      },
                      {
                        text:
                          '100%' +
                          (this.ActionsTRANSFER.PERCENT[
                            message.chat.id
                          ]?.includes('percent_1')
                            ? ' ✅'
                            : ''),
                        callback_data: 'transfer_percent_1',
                      },
                    ],
                    [
                      {
                        text: '📝 Select Token',
                        callback_data: 'transfer_select_token',
                      },
                    ],
                    [{ text: 'Wallet: ', callback_data: 'view_token_select' }],
                    list_token_transfer,
                    [
                      {
                        text: '💸 Transfer TOKEN (SEND TX)',
                        callback_data: 'transfer_tokens_stx',
                      },
                    ],
                  ],
                },
              },
            );
          }
        }

        if (
          mess_rep.text.includes('custom amount you want to swap') ||
          mess_rep.text.includes('custom slippage you want to swap') ||
          mess_rep.text.includes('custom token you want to swap')
        ) {
          if (mess_rep.text.includes('amount')) {
            this.ActionsSWAP.CUSTOM_AMOUNT[message.chat.id] = message.text;
          }
          if (mess_rep.text.includes('slippage')) {
            this.ActionsSWAP.CUSTOM_SLIP[message.chat.id] = message.text;
          }
          if (mess_rep.text.includes('token')) {
            this.ActionsSWAP.CUSTOM_TOKEN[message.chat.id] = message.text;
          }

          const type_coin_change = this.ActionsSWAP.TYPE[message.chat.id]
            .split('_')[1]
            .toUpperCase();
          const {
            infoAccount: information_swap,
            funcMenuWallet: func_menu_wallet_swap,
            wallets: wallets_swap,
          } = await this.getAllInfoChat(message);

          const wallet_choose =
            wallets_swap[
              +this.ActionsSWAP.WALLET[message.chat.id].split('_')[2] - 1
            ];

          const listCoin = [];
          const listToken = [];
          let menuListToken = '';
          const coins = await getAllBalances(wallet_choose.privateKey);

          for (const [key, value] of Object.entries(this.TypeCoinTRADE)) {
            const coin = coins.find((co) => co?.coinType === value);

            listToken.push({
              text:
                (this.ActionsSWAP.TOKEN[message.chat.id].split('_')[2] ===
                  key.toLowerCase() &&
                this.ActionsSWAP.CUSTOM_TOKEN[message.chat.id] === ''
                  ? '✅ '
                  : '') + key,
              callback_data: `swap_token_${key.toLowerCase()}`,
            });
            if (coin) {
              const amount = (
                +coin.totalBalance / Math.pow(10, coin.del)
              ).toFixed(4);
              menuListToken += `\n• *${key}*: \`${amount}\``;
              listCoin.push({
                coinType: value,
                symbol: key,
                data: `swap_${key.toLowerCase()}_type`,
                amount,
              });
            }
          }
          const convertListToken = listToken.reduce((acc, curr, index) => {
            const idx = index % 6;
            if (!acc[idx]) {
              acc.push([curr]);
            } else {
              acc[idx] = [...acc[idx], curr];
            }
            return acc;
          }, []);

          const typeAction = this.ActionsSWAP.ACTION[message.chat.id].includes(
            'buy',
          )
            ? 'Buy Tokens'
            : 'Sell Tokens';

          const textMenu = `➕ *${typeAction}* ➕\n\n═⛽️ *Token list* ═${menuListToken}\n\n═⛽️ *Gas Settings* | \\[[Info](https://www.google.com/)\\] ═\n\n•🔬 *Aggregation*: For all swaps, we compare quotes from aggregators and simulate results to maximize your trades.\n• 🌟 Easy Mode automatically use the safest and optimal settings for your swaps, ensuring that you receive the best price possible.`;

          const positionWallet =
            this.ActionsSWAP.WALLET[message.chat.id].split('_')[2];

          const swap_token = this.ActionsSWAP.TOKEN[message.chat.id]
            .split('_')[2]
            .toUpperCase();
          const swap_type_token =
            this.ActionsSWAP.CUSTOM_TOKEN[message.chat.id] === ''
              ? this.TypeCoinTRADE[swap_token]
              : this.ActionsSWAP.CUSTOM_TOKEN[message.chat.id];

          const [_address, _low, _up] = swap_type_token.split('::');
          const convert_address =
            _address.length > 30
              ? _address.slice(0, 7) + '...' + _address.slice(-5)
              : _address;
          const convert = `${convert_address}::${_low}::${_up}`;

          await this.bot.deleteMessage(message.chat.id, message.message_id - 2);
          await this.bot.deleteMessage(message.chat.id, message.message_id - 1);
          await this.bot.deleteMessage(message.chat.id, message.message_id);

          if (this.ActionsSWAP.ACTION[message.chat.id] === 'swap_buy_token') {
            this.bot.sendMessage(
              message.chat.id,
              replaceText(information_swap + textMenu),
              {
                disable_web_page_preview: true,
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '✖️ Close', callback_data: 'edit_menu' }],
                    [
                      {
                        text: '✅ Buy Token',
                        callback_data: 'swap_buy_token',
                      },
                      {
                        text: 'Sell Token',
                        callback_data: 'swap_sell_token',
                      },
                    ],
                    [
                      {
                        text: '⬜️ SELECT WALLETS ⬜️',
                        callback_data: 'swap_wallet',
                      },
                    ],
                    ...func_menu_wallet_swap(+positionWallet, 'swap'),

                    [
                      {
                        text: '⬜️ BUY WITH ⬜️',
                        callback_data: 'swap_with',
                      },
                    ],
                    listCoin.map((coin) => ({
                      text:
                        (this.ActionsSWAP.TYPE[message.chat.id] === coin.data
                          ? '✅ '
                          : '') + `${coin.symbol}: ${coin.amount}`,
                      callback_data: coin.data,
                    })),
                    [
                      {
                        text: '⬜️ BUY AMOUNT ⬜️',
                        callback_data: 'swap_amount',
                      },
                    ],
                    [
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_AMOUNT[message.chat.id] ===
                            '' &&
                          this.ActionsSWAP.AMOUNT[message.chat.id].includes(
                            'amount_0.1',
                          )
                            ? '✅ '
                            : '') + `0.1 ${type_coin_change}`,
                        callback_data: 'swap_amount_0.1',
                      },
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_AMOUNT[message.chat.id] ===
                            '' &&
                          this.ActionsSWAP.AMOUNT[message.chat.id].includes(
                            'amount_0.5',
                          )
                            ? '✅ '
                            : '') + `0.5 ${type_coin_change}`,
                        callback_data: 'swap_amount_0.5',
                      },
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_AMOUNT[message.chat.id] !==
                          ''
                            ? '✅ '
                            : '') +
                          `✎${
                            this.ActionsSWAP.CUSTOM_AMOUNT[message.chat.id] ||
                            0.25
                          } ${type_coin_change}`,
                        callback_data: 'swap_amount_custom',
                      },
                    ],

                    [
                      {
                        text: '⬜️ SLIPPAGE ⬜️',
                        callback_data: 'slippage_token',
                      },
                    ],
                    [
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_SLIP[message.chat.id] ===
                            '' &&
                          this.ActionsSWAP.SLIPPAGE[message.chat.id].includes(
                            'slippage_auto',
                          )
                            ? '✅ '
                            : '') + 'Auto',
                        callback_data: 'swap_slippage_auto',
                      },
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_SLIP[message.chat.id] ===
                            '' &&
                          this.ActionsSWAP.SLIPPAGE[message.chat.id].includes(
                            'slippage_3',
                          )
                            ? '✅ '
                            : '') + '3%',
                        callback_data: 'swap_slippage_3',
                      },
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_SLIP[message.chat.id] !== ''
                            ? '✅ '
                            : '') +
                          `✎${this.ActionsSWAP.CUSTOM_SLIP[message.chat.id] || 10}%`,
                        callback_data: 'swap_slippage_custom',
                      },
                    ],

                    [
                      {
                        text: '⬜️ Select Token ⬜️',
                        callback_data: 'swap_select_token',
                      },
                    ],
                    [
                      {
                        text: `Wallet: ${convert}`,
                        callback_data: 'view_token_select',
                      },
                    ],
                    ...convertListToken,
                    [
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_TOKEN[message.chat.id] !== ''
                            ? '✅ '
                            : '') + `Custom Token: ${convert}`,
                        callback_data: 'swap_custom_token',
                      },
                    ],
                    [
                      {
                        text: '📩 Send TX 📩',
                        callback_data: 'swap_send_transaction',
                      },
                    ],
                  ],
                },
              },
            );
          }

          if (this.ActionsSWAP.ACTION[message.chat.id] === 'swap_sell_token') {
            this.bot.sendMessage(
              message.chat.id,
              replaceText(information_swap + textMenu),
              {
                disable_web_page_preview: true,
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '✖️ Close', callback_data: 'edit_menu' }],
                    [
                      {
                        text: 'Buy Token',
                        callback_data: 'swap_buy_token',
                      },
                      {
                        text: '✅ Sell Token',
                        callback_data: 'swap_sell_token',
                      },
                    ],
                    [
                      {
                        text: '⬜️ SELECT WALLETS ⬜️',
                        callback_data: 'swap_wallet',
                      },
                    ],
                    ...func_menu_wallet_swap(+positionWallet, 'swap'),
                    [
                      {
                        text: '⬜️ SELL TOKEN ⬜️',
                        callback_data: 'swap_with',
                      },
                    ],
                    listCoin.map((coin) => ({
                      text:
                        (this.ActionsSWAP.TYPE[message.chat.id] === coin.data
                          ? '✅ '
                          : '') + `${coin.symbol}: ${coin.amount}`,
                      callback_data: coin.data,
                    })),
                    [
                      {
                        text: '⬜️ SELECT AMOUNT ⬜️',
                        callback_data: 'swap_amount',
                      },
                    ],
                    [
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_AMOUNT[message.chat.id] ===
                            '' &&
                          this.ActionsSWAP.AMOUNT[message.chat.id].includes(
                            'amount_0.1',
                          )
                            ? '✅ '
                            : '') + `0.1 ${type_coin_change}`,
                        callback_data: 'swap_amount_0.1',
                      },
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_AMOUNT[message.chat.id] ===
                            '' &&
                          this.ActionsSWAP.AMOUNT[message.chat.id].includes(
                            'amount_0.5',
                          )
                            ? '✅ '
                            : '') + `0.5 ${type_coin_change}`,
                        callback_data: 'swap_amount_0.5',
                      },
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_AMOUNT[message.chat.id] !==
                          ''
                            ? '✅ '
                            : '') +
                          `✎${
                            this.ActionsSWAP.CUSTOM_AMOUNT[message.chat.id] ||
                            0.25
                          } ${type_coin_change}`,
                        callback_data: 'swap_amount_custom',
                      },
                    ],
                    [
                      {
                        text: '⬜️ SLIPPAGE ⬜️',
                        callback_data: 'slippage_token',
                      },
                    ],
                    [
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_SLIP[message.chat.id] ===
                            '' &&
                          this.ActionsSWAP.SLIPPAGE[message.chat.id].includes(
                            'slippage_auto',
                          )
                            ? '✅ '
                            : '') + 'Auto',
                        callback_data: 'swap_slippage_auto',
                      },
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_SLIP[message.chat.id] ===
                            '' &&
                          this.ActionsSWAP.SLIPPAGE[message.chat.id].includes(
                            'slippage_3',
                          )
                            ? '✅ '
                            : '') + '3%',
                        callback_data: 'swap_slippage_3',
                      },
                      {
                        text:
                          (this.ActionsSWAP.CUSTOM_SLIP[message.chat.id] !== ''
                            ? '✅ '
                            : '') +
                          `✎${this.ActionsSWAP.CUSTOM_SLIP[message.chat.id] || 10}%`,
                        callback_data: 'swap_slippage_custom',
                      },
                    ],

                    [
                      {
                        text: '⬜️ RECEIVE TOKEN ⬜️',
                        callback_data: 'swap_receive',
                      },
                    ],
                    ...convertListToken,

                    [
                      {
                        text: '📝 Send TX 📝',
                        callback_data: 'swap_send_transaction',
                      },
                    ],
                  ],
                },
              },
            );
          }
        }

        if (mess_rep.text.includes('custom wallet address')) {
          const wallet = this.ActionsWALLET.IMPORT[message.chat.id].toString();
          const indexWallet = +wallet.charAt(wallet.length - 1) - 1;

          await this.control.importWallet(
            indexWallet,
            message.text,
            message.chat.id,
          );
          this.bot.deleteMessage(message.chat.id, message.message_id - 2);

          this.bot.sendMessage(message.chat.id, 'Imported wallet successful!');
          this.mainMenuQuest(message);
        }

        if (mess_rep.text.includes('you want auto sell')) {
          const targets = ['%', 'OFF'];
          const {
            functionSnipeWallet,
            infoAccount: text,
            wallets,
          } = await this.getAllInfoChat(message);

          console.log('vao auto sell roi', message.text);
          if (!targets.some((target) => message.text.includes(target))) {
            return this.bot.sendMessage(
              message.chat.id,
              replaceTextItalic('⚠️  _Format value error_ !'),
              { parse_mode: 'MarkdownV2' },
            );
          }

          const textMenu =
            text +
            `══🎯 *Token Sniper* 🎯══\n*Token Sniper*: Enter token addresses you wish to snipe or import tokens from the deploy scanner.\n\n`;
          const snipe = await this.control.getSniperForUser({
            botId: message.chat.id,
          });
          this.ActionsSNIPE.AUTO_SELL[message.chat.id] = message.text;
          this.loopRemoveMsg(message);

          await this.menu.tokenSniper({
            bot: this.bot,
            text: textMenu,
            function: functionSnipeWallet,
            walletToken: this.ActionsSNIPE.WALLETS[message.chat.id] || [],
            sniperToken: snipe.tokenSnipe,
            wallets,
            message: message,
            maxSpend: this.ActionsSNIPE.MAX_SPEND[message.chat.id],
            autoSell: this.ActionsSNIPE.AUTO_SELL[message.chat.id],
            firstFail: this.ActionsSNIPE.FIRST_FAIL[message.chat.id],
            antiRug: this.ActionsSNIPE.ANTI_RUG[message.chat.id],
            send: true,
          });
        }

        if (mess_rep.text.includes('you want spend sell')) {
          console.time('max-spend-amt');
          const {
            functionSnipeWallet,
            infoAccount: text,
            wallets,
          } = await this.getAllInfoChat(message);

          console.log('vao day roi', {
            check: message.text.split('SUI')[0].trim(),
          });

          if (!message.text.includes('SUI')) {
            return this.bot.sendMessage(
              message.chat.id,
              replaceTextItalic('⚠️  _Format value error_ !'),
              { parse_mode: 'MarkdownV2' },
            );
          }

          const textMenu =
            text +
            `══🎯 *Token Sniper* 🎯══\n*Token Sniper*: Enter token addresses you wish to snipe or import tokens from the deploy scanner.\n\n`;
          const snipe = await this.control.getSniperForUser({
            botId: message.chat.id,
          });

          const newData = message.text.split('SUI')[0].trim();
          this.ActionsSNIPE.MAX_SPEND[message.chat.id] = newData;

          this.loopRemoveMsg(message);
          await this.menu.tokenSniper({
            bot: this.bot,
            text: textMenu,
            function: functionSnipeWallet,
            walletToken: this.ActionsSNIPE.WALLETS[message.chat.id] || [],
            sniperToken: snipe.tokenSnipe,
            wallets,
            message: message,
            maxSpend: this.ActionsSNIPE.MAX_SPEND[message.chat.id],
            autoSell: this.ActionsSNIPE.AUTO_SELL[message.chat.id],
            firstFail: this.ActionsSNIPE.FIRST_FAIL[message.chat.id],
            antiRug: this.ActionsSNIPE.ANTI_RUG[message.chat.id],
            send: true,
          });
          console.timeEnd('max-spend-amt');
        }

        if (mess_rep.text.includes('address you wish to snipe')) {
          if (
            !message.text.includes('::') ||
            message.text.split('::').length !== 3
          ) {
            return this.bot.sendMessage(
              message.chat.id,
              replaceTextItalic('⚠️  _Format value error_ !'),
              { parse_mode: 'MarkdownV2' },
            );
          }

          if (
            this.ActionsSNIPE.MAX_SPEND[message.chat.id] === '' ||
            this.ActionsSNIPE.WALLETS[message.chat.id].length === 0
          ) {
            this.loopRemoveMsg(message);

            this.ActionsSNIPE.WALLETS[message.chat.id] = [];
            this.ActionsSNIPE.MAX_SPEND[message.chat.id] = '';
            this.ActionsSNIPE.AUTO_SELL[message.chat.id] = 'OFF';
            this.ActionsSNIPE.FIRST_FAIL[message.chat.id] = false;
            this.ActionsSNIPE.ANTI_RUG[message.chat.id] = false;

            await this.bot.sendMessage(
              message.chat.id,
              replaceTextItalic('⚠️ _Please enter enough information_ !'),
              { parse_mode: 'MarkdownV2' },
            );

            const {
              functionSnipeWallet,
              infoAccount: text,
              wallets,
            } = await this.getAllInfoChat(message);
            const textMenu =
              text +
              `══🎯 *Token Sniper* 🎯══\n*Token Sniper*: Enter token addresses you wish to snipe or import tokens from the deploy scanner.\n\n`;
            const sniper = await this.control.getSniperForUser({
              botId: message.chat.id,
            });

            await this.menu.tokenSniper({
              bot: this.bot,
              text: textMenu,
              function: functionSnipeWallet,
              walletToken: this.ActionsSNIPE.WALLETS[message.chat.id] || [],
              sniperToken: sniper.tokenSnipe,
              wallets,
              message: message,
              maxSpend: this.ActionsSNIPE.MAX_SPEND[message.chat.id],
              autoSell: this.ActionsSNIPE.AUTO_SELL[message.chat.id],
              firstFail: this.ActionsSNIPE.FIRST_FAIL[message.chat.id],
              antiRug: this.ActionsSNIPE.ANTI_RUG[message.chat.id],
              send: true,
            });
            return;
          }

          const isExactlyLiq = await this.control.checkExactlySnipe(
            message.text,
          );
          // TODO: delete first fail
          if (isExactlyLiq && !message.text.includes('TEST')) {
            this.ActionsSNIPE.WALLETS[message.chat.id] = [];
            this.ActionsSNIPE.MAX_SPEND[message.chat.id] = '';
            this.ActionsSNIPE.AUTO_SELL[message.chat.id] = 'OFF';
            this.ActionsSNIPE.FIRST_FAIL[message.chat.id] = false;
            this.ActionsSNIPE.ANTI_RUG[message.chat.id] = false;

            this.bot.sendMessage(
              message.chat.id,
              replaceTextItalic('⚠️ _Go to the Swap to buy this token_ !'),
              { parse_mode: 'MarkdownV2' },
            );
            return;
          }
          this.bot.sendMessage(
            message.chat.id,
            replaceText('💹 *Creating ...*'),
            { parse_mode: 'MarkdownV2' },
          );

          const convert = (token: string) => {
            const tax = token.split(' ')[0].split('::');
            const taxSlice = tax[0].includes('0x') ? tax[0].slice(2) : tax[0];
            const cvtTaxSlice = Array.from({ length: 64 - taxSlice.length })
              .map(() => '0')
              .join('');

            return (
              '0x' + cvtTaxSlice + taxSlice + '::' + tax[1] + '::' + tax[2]
            );
          };
          const {
            functionSnipeWallet,
            infoAccount: text,
            wallets,
            user,
          } = await this.getAllInfoChat(message);
          const textMenu =
            text +
            `══🎯 *Token Sniper* 🎯══\n*Token Sniper*: Enter token addresses you wish to snipe or import tokens from the deploy scanner.\n\n`;

          const newData = convert(message.text);
          const amountSnipe = await this.control.getCountSnipe({
            token: newData,
            firstOfFail: true,
          });

          const snipe = await this.control.getSniperForUser({
            botId: message.chat.id,
          });

          const isExactly = snipe.tokenSnipe.includes(newData);
          if (isExactly && !message.text.includes('TEST')) {
            return this.bot.sendMessage(
              message.chat.id,
              replaceTextItalic('⚠️ _The token address already exists_ !'),
              { parse_mode: 'MarkdownV2' },
            );
          }

          const fof = this.ActionsSNIPE.FIRST_FAIL[message.chat.id];
          await this.control.createSniper({
            userId: user,
            wallets: this.ActionsSNIPE.WALLETS[message.chat.id] || [],
            token: newData,
            firstOfFail: fof,
            noSwap: fof && amountSnipe > 10,
            antiRug: this.ActionsSNIPE.ANTI_RUG[message.chat.id],
            maxSpend: this.ActionsSNIPE.MAX_SPEND[message.chat.id],
            autoSell: this.ActionsSNIPE.AUTO_SELL[message.chat.id],
            swapped: false,
            swapDex: '',
            pool: '',
            firstPrice: 0,
            lastPrice: 0,
            hash: '',
            slippage: '0.001',
          });
          this.ActionsSNIPE.WALLETS[message.chat.id] = [];
          this.ActionsSNIPE.MAX_SPEND[message.chat.id] = '';
          this.ActionsSNIPE.AUTO_SELL[message.chat.id] = 'OFF';
          this.ActionsSNIPE.FIRST_FAIL[message.chat.id] = false;
          this.ActionsSNIPE.ANTI_RUG[message.chat.id] = false;

          console.log({ newData, botId: message.chat.id });
          const newSnipe = await this.control.getSniperForUser({
            botId: message.chat.id,
          });

          this.loopRemoveMsg(message);
          await this.menu.tokenSniper({
            bot: this.bot,
            text: textMenu,
            function: functionSnipeWallet,
            walletToken: this.ActionsSNIPE.WALLETS[message.chat.id] || [],
            sniperToken: newSnipe.tokenSnipe,
            wallets,
            message: message,
            maxSpend: this.ActionsSNIPE.MAX_SPEND[message.chat.id],
            autoSell: this.ActionsSNIPE.AUTO_SELL[message.chat.id],
            firstFail: this.ActionsSNIPE.FIRST_FAIL[message.chat.id],
            antiRug: this.ActionsSNIPE.ANTI_RUG[message.chat.id],
            send: true,
          });
        }
      } else {
        if (message.chat.type !== 'private') {
          this.bot.sendMessage(
            message.chat.id,
            'You have not correct access !!',
          );
        } else {
          if (message.text.charAt(0) === '/') {
            switch (message.text) {
              case '/start':
                return this.mainMenuQuest(message);
              default:
                this.bot.deleteMessage(message.chat.id, message.message_id);
                return 0;
            }
          } else if (message.text) {
            this.bot.deleteMessage(message.chat.id, message.message_id);
          }
        }
      }
    } catch (error) {
      console.log('error message reply:', error.message);

      this.bot
        .deleteMessage(message.chat.id, message.message_id)
        .catch(() => {
          return;
        })
        .finally(() => {
          this.bot.sendMessage(
            message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
          this.updateMenuQuest(message.chat.id);
        });
    }
  }

  private async getAllUser() {
    try {
      return await this.control.getAllUser({ verify: true });
    } catch (error) {
      console.log('error get all user:', error.message);
    }
  }

  async mainMenuQuest(message: TelegramBot.Message) {
    const { user, textMessageMenu, position, infoAccount } =
      await this.getAllInfoChat(message);

    if (user && user?.verify) {
      this.bot.deleteMessage(message.chat.id, message.message_id);

      return this.bot.sendMessage(
        message.chat.id,
        replaceText(textMessageMenu),
        {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: this.getButtonMenu(position),
          },
        },
      );
    }

    this.bot.deleteMessage(message.chat.id, message.message_id);
    return this.bot.sendMessage(
      message.chat.id,
      replaceText(
        infoAccount +
          '🪙 CenBot | [Website](https://www.google.com/) 🪙\n\n*Welcome to CenBot Telegram! Verify Twitter to continue.*',
      ),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Verify Twitter',
                url: this.getOauthUrl(message.chat.id),
              },
            ],
          ],
        },
      },
    );
  }

  async callbackMenuQuest(message: TelegramBot.Message) {
    const { textMessageMenu, position } = await this.getAllInfoChat(message);

    this.bot.editMessageText(replaceText(textMessageMenu), {
      chat_id: message.chat.id,
      message_id: message.message_id,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: this.getButtonMenu(position),
      },
    });
  }

  async updateMenuQuest(botId: number, join?: boolean) {
    try {
      const { textMessageMenu, position, infoAccount } =
        await this.getAllInfoChat({
          message_id: 0,
          date: 0,
          chat: { id: botId, type: 'group' },
        });

      if (join) {
        const link_channel = this.config.getOrThrow<string>('TELEGRAM_CHANNEL');
        await this.bot.sendMessage(
          botId,
          replaceText(
            infoAccount +
              '🪙 CenBot | [Website](https://www.google.com/) 🪙\n\n*Join channel to continue.*',
          ),
          {
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Join channel',
                    url: link_channel,
                  },
                ],
              ],
            },
          },
        );
      }
      await this.bot.sendMessage(botId, replaceText(textMessageMenu), {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: this.getButtonMenu(position),
        },
      });
    } catch (error) {
      console.log('error update menu:', error.message);
    }
  }

  async updateFollowChat(id: number, message_id: number) {
    try {
      const BE_URL = this.config.getOrThrow<string>('BE_URL');
      const uri = `${BE_URL}/bot/twitter/follow/${id}/${message_id}/introduction`;

      const { infoAccount, textSocial, task } = await this.getAllInfoChat({
        message_id: 0,
        date: 0,
        chat: { username: '', id, type: 'group' },
      });

      this.bot.editMessageText(replaceText(infoAccount + textSocial), {
        chat_id: id,
        message_id: message_id,
        disable_web_page_preview: true,
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `${task.following ? '✅ Completed' : '♻ Processing'} Follow @Cenbot_org`,
                callback_data: 'social_process_follow',
              },
            ],
            [
              {
                text: 'Open @Cenbot_org on X',
                url: uri,
              },
            ],
            [
              { text: '🔙️ Back', callback_data: 'root_social_task' },
              { text: '⏪ Main menu', callback_data: 'edit_menu' },
            ],
          ],
        },
      });
      return 0;
    } catch (error) {
      console.log('error follow chat:', error.message);
    }
  }

  async updateLikeChat(id: number, message_id: number) {
    try {
      const BE_URL = this.config.getOrThrow<string>('BE_URL');
      const uri = `${BE_URL}/bot/twitter/like/${id}/${message_id}`;

      const { infoAccount, textSocial, task } = await this.getAllInfoChat({
        message_id: 0,
        date: 0,
        chat: { username: '', id, type: 'group' },
      });

      this.bot.editMessageText(replaceText(infoAccount + textSocial), {
        chat_id: id,
        message_id: message_id,
        disable_web_page_preview: true,
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `${task.introduction_like ? '✅ Completed' : '♻ Processing'} like @Cenbot_org`,
                callback_data: 'social_process_like',
              },
            ],
            [
              {
                text: `Open Introduction on X`,
                url: `${uri}/introduction`,
              },
            ],
            [
              {
                text: `${task.partnership_like ? '✅ Completed like' : 'Open'} Partnership X PikaSui on X`,
                url: `${uri}/partnership`,
              },
            ],
            [
              {
                text: `${task.censpecial_like ? '✅ Completed like' : 'Open'} Why xCEN special on X`,
                url: `${uri}/censpecial`,
              },
            ],
            [
              {
                text: `${task.iscen_like ? '✅ Completed like' : 'Open'} What is xCEN on X`,
                url: `${uri}/iscen`,
              },
            ],
            [
              {
                text: `${task.mission_like ? '✅ Completed like' : 'Open'} Mission on X`,
                url: `${uri}/mission`,
              },
            ],
            [
              {
                text: `${task.vision_like ? '✅ Completed like' : 'Open'} Vision on X`,
                url: `${uri}/vision`,
              },
            ],
            [
              {
                text: `${task.bounty_like ? '✅ Completed like' : 'Open'} Bug Bounty on X`,
                url: `${uri}/bounty`,
              },
            ],
            [
              { text: '🔙️ Back', callback_data: 'root_social_task' },
              { text: '⏪ Main menu', callback_data: 'edit_menu' },
            ],
          ],
        },
      });
    } catch (error) {
      console.log('error like chat:', error.message);
    }
  }

  async updateRetweetChat(id: number, message_id: number) {
    try {
      const BE_URL = this.config.getOrThrow<string>('BE_URL');
      const uri = `${BE_URL}/bot/twitter/retweet/${id}/${message_id}`;

      const { infoAccount, textSocial, task } = await this.getAllInfoChat({
        message_id: 0,
        date: 0,
        chat: { username: '', id, type: 'group' },
      });

      this.bot.editMessageText(replaceText(infoAccount + textSocial), {
        chat_id: id,
        message_id: message_id,
        disable_web_page_preview: true,
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `${task.introduction_retweet ? '✅ Completed' : '♻ Processing'} retweet @Cenbot_org`,
                callback_data: 'social_process_retweet',
              },
            ],
            [
              {
                text: 'Open Introduction on X',
                url: `${uri}/introduction`,
              },
            ],
            [
              {
                text: `${task.partnership_retweet ? '✅ Completed retweet' : 'Open'} Partnership X PikaSui on X`,
                url: `${uri}/partnership`,
              },
            ],
            [
              {
                text: `${task.censpecial_retweet ? '✅ Completed retweet' : 'Open'} Why xCEN special on X`,
                url: `${uri}/censpecial`,
              },
            ],
            [
              {
                text: `${task.iscen_retweet ? '✅ Completed retweet' : 'Open'} What is xCEN on X`,
                url: `${uri}/iscen`,
              },
            ],
            [
              {
                text: `${task.mission_retweet ? '✅ Completed retweet' : 'Open'} Mission on X`,
                url: `${uri}/mission`,
              },
            ],
            [
              {
                text: `${task.vision_retweet ? '✅ Completed retweet' : 'Open'} Vision on X`,
                url: `${uri}/vision`,
              },
            ],
            [
              {
                text: `${task.bounty_retweet ? '✅ Completed like' : 'Open'} Bug Bounty on X`,
                url: `${uri}/bounty`,
              },
            ],
            [
              { text: '🔙️ Back', callback_data: 'root_social_task' },
              { text: '⏪ Main menu', callback_data: 'edit_menu' },
            ],
          ],
        },
      });
    } catch (error) {
      console.log('error introduction_retweet chat:', error.message);
    }
  }

  async loopRemoveMsg(message: TelegramBot.Message) {
    await new Promise(() => {
      for (let i = 0; i < 151; i++) {
        this.bot
          .deleteMessage(message.chat.id, message.message_id + 50 - i)
          .catch(() => {
            return;
          });
      }
    });
  }

  // optimize
  async getAllInfoChat(message: TelegramBot.Message) {
    const {
      chat: { username = '', id },
    } = message;
    const code = this.getCodeVerified();
    const result = await this.control.createForUser({
      username,
      botId: id,
      point: 0,
      verify: false,
      xId: '',
      xUsername: '',
      xAvatar: '',
      code,
      referrer: '',
    });

    const { user, wallets, rank, task, count } = result;

    const infoAcc =
      `*SUI*: \`${this.InfoSUI.PRICE}\` ═ *Block*: \`${this.InfoSUI.BLOCK}\` ═ *Gas*: \`${this.InfoSUI.GAS}\`` +
      (user && user?.verify
        ? `\n\nX: [@${user.xUsername}](https://twitter.com/${user.xUsername}) \nxCEN balance: ${user.point} \nRank: ${rank} \n\n`
        : '\n\n');

    const infoHTML =
      `<b>SUI</b>: <code>${this.InfoSUI.PRICE}</code> ═ <b>Block</b>: <code>${this.InfoSUI.BLOCK}</code> ═ <b>Gas</b>: <code>${this.InfoSUI.GAS}</code>` +
      (user && user?.verify
        ? `\n\nX: <a href="https://twitter.com/${user.xUsername}">@${user.xUsername}</a> \nxCEN balance: ${user.point} \nRank: ${rank} \n\n`
        : '\n\n');

    const convertWallet = () => {
      return (
        '═══ Your Wallets ═══\n' +
        wallets
          .map((item) => ({
            link: `https://suiexplorer.com/address/${item.address}`,
            address: item.address,
            balance: item.balance,
            price: formatPrice(+item.balance * +this.InfoSUI.PRICE),
            main: item.main,
          }))
          .map(
            (item, idx) =>
              `▰ [Wallet-w${idx + 1}](${item.link}) ▰ ${item.main ? '✅' : ''}\n*Balance*: \`${item.balance} SUI\` \\($${item.price}\\)\n\`${item.address}\`\n\n`,
          )
          .join('')
      );
    };
    const textWallet = () => {
      return wallets
        .map((item) => ({
          link: `https://suiexplorer.com/address/${item.address}`,
          address: item.address,
          balance: item.balance,
          price: formatPrice(+item.balance * +this.InfoSUI.PRICE),
          main: item.main,
        }))
        .map(
          (item, idx) =>
            `▰ [Wallet-w${idx + 1}](${item.link}) ▰\n*Balance*: \`${item.balance} SUI\` \\($${item.price}\\)\n\`${item.address}\`\n\n`,
        )
        .join('');
    };

    const uri_cenbot_post =
      this.config.getOrThrow<string>('X_INTRODUCTION_URL');
    const uri_cenbot_x = this.config.getOrThrow<string>('X_CENBOT_FOLLOW_URI');

    const menuSocialTask =
      `📎 *Social Task*\n• Like: [Twitter Link](${uri_cenbot_post}) ${task.introduction_like ? ' ✅' : ''}` +
      `\n• Repost: [Twitter Link](${uri_cenbot_post}) ${task.introduction_retweet ? ' ✅' : ''}` +
      `\n• Follow: [Twitter Link](${uri_cenbot_x}) ${task.following ? ' ✅' : ''}`;

    const mainWallet = wallets.findIndex((item) => item.main) + 1;
    const funcMenuWallet = (check: number, pref: string) => {
      const length = wallets.length;
      const isMain = (position: number) => (position === check ? '✅' : '');

      switch (length) {
        case 3:
          return [
            [
              {
                text: '🧑‍💼 Wallet 1 ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: '🧑‍💼 Wallet 2 ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
            [
              {
                text: '🧑‍💼 Wallet 3 ' + isMain(3),
                callback_data: `${pref}_wallet_3`,
              },
            ],
          ];
        case 4:
          return [
            [
              {
                text: '🧑‍💼 Wallet 1 ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: '🧑‍💼 Wallet 2 ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
            [
              {
                text: '🧑‍💼 Wallet 3 ' + isMain(3),
                callback_data: `${pref}_wallet_3`,
              },
              {
                text: '🧑‍💼 Wallet 4 ' + isMain(4),
                callback_data: `${pref}_wallet_4`,
              },
            ],
          ];
        case 5:
          return [
            [
              {
                text: '🧑‍💼 Wallet 1 ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: '🧑‍💼 Wallet 2 ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
            [
              {
                text: '🧑‍💼 Wallet 3 ' + isMain(3),
                callback_data: `${pref}_wallet_3`,
              },

              {
                text: '🧑‍💼 Wallet 4 ' + isMain(4),
                callback_data: `${pref}_wallet_4`,
              },
            ],
            [
              {
                text: '🧑‍💼 Wallet 5 ' + isMain(5),
                callback_data: `${pref}_wallet_5`,
              },
            ],
          ];
        default:
          return [
            [
              {
                text: '🧑‍💼 Wallet 1 ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: '🧑‍💼 Wallet 2 ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
          ];
      }
    };

    const functionMenuWallets = (listPosition: number[], pref: string) => {
      const length = wallets.length;
      const isMain = (position: number) =>
        listPosition.includes(position) ? '✅' : '';

      switch (length) {
        case 3:
          return [
            [
              {
                text: '🧑‍💼 Wallet 1 ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: '🧑‍💼 Wallet 2 ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
            [
              {
                text: '🧑‍💼 Wallet 3 ' + isMain(3),
                callback_data: `${pref}_wallet_3`,
              },
            ],
          ];
        case 4:
          return [
            [
              {
                text: '🧑‍💼 Wallet 1 ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: '🧑‍💼 Wallet 2 ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
            [
              {
                text: '🧑‍💼 Wallet 3 ' + isMain(3),
                callback_data: `${pref}_wallet_3`,
              },
              {
                text: '🧑‍💼 Wallet 4 ' + isMain(4),
                callback_data: `${pref}_wallet_4`,
              },
            ],
          ];
        case 5:
          return [
            [
              {
                text: '🧑‍💼 Wallet 1 ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: '🧑‍💼 Wallet 2 ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
            [
              {
                text: '🧑‍💼 Wallet 3 ' + isMain(3),
                callback_data: `${pref}_wallet_3`,
              },

              {
                text: '🧑‍💼 Wallet 4 ' + isMain(4),
                callback_data: `${pref}_wallet_4`,
              },
            ],
            [
              {
                text: '🧑‍💼 Wallet 5 ' + isMain(5),
                callback_data: `${pref}_wallet_5`,
              },
            ],
          ];
        default:
          return [
            [
              {
                text: '🧑‍💼 Wallet 1 ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: '🧑‍💼 Wallet 2 ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
          ];
      }
    };

    const functionSnipeWallet = (listPosition: number[], pref: string) => {
      const length = wallets.length;
      const isMain = (position: number) =>
        listPosition.includes(position) ? '🟢' : '🔴';

      switch (length) {
        case 3:
          return [
            [
              {
                text: 'Wallet 1: ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: 'Wallet 2: ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
            [
              {
                text: 'Wallet 3: ' + isMain(3),
                callback_data: `${pref}_wallet_3`,
              },
            ],
          ];
        case 4:
          return [
            [
              {
                text: 'Wallet 1: ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: 'Wallet 2: ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
            [
              {
                text: 'Wallet 3: ' + isMain(3),
                callback_data: `${pref}_wallet_3`,
              },
              {
                text: 'Wallet 4: ' + isMain(4),
                callback_data: `${pref}_wallet_4`,
              },
            ],
          ];
        case 5:
          return [
            [
              {
                text: 'Wallet 1: ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: 'Wallet 2: ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
            [
              {
                text: 'Wallet 3: ' + isMain(3),
                callback_data: `${pref}_wallet_3`,
              },

              {
                text: 'Wallet 4: ' + isMain(4),
                callback_data: `${pref}_wallet_4`,
              },
            ],
            [
              {
                text: 'Wallet 5: ' + isMain(5),
                callback_data: `${pref}_wallet_5`,
              },
            ],
          ];
        default:
          return [
            [
              {
                text: 'Wallet 1: ' + isMain(1),
                callback_data: `${pref}_wallet_1`,
              },
              {
                text: 'Wallet 2: ' + isMain(2),
                callback_data: `${pref}_wallet_2`,
              },
            ],
          ];
      }
    };

    return {
      user,
      wallets,
      task,
      count,
      textMessageMenu: infoAcc + convertWallet(),
      textInfoHtml: infoHTML,
      textWallet: textWallet(),
      infoAccount: infoAcc,
      position: mainWallet,
      listWalletMenu: funcMenuWallet(mainWallet, 'check'),
      funcMenuWallet,
      functionMenuWallets,
      functionSnipeWallet,
      textSocial: menuSocialTask,
    };
  }

  getOauthUrl(botId: number): string {
    const rootUrl = this.config.getOrThrow<string>('TWITTER_OAUTH_VERIFY_URL');
    const options = {
      response_type: 'code',
      client_id: this.config.getOrThrow<string>('CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('X_CALLBACK_URL'),
      scope: ['users.read', 'tweet.read'].join(' '),
      state: botId.toString(),
      code_challenge: this.config.getOrThrow<string>('CODE_TWITTER_CHALLENGE'),
      code_challenge_method: 'S256',
    };
    const qs = new URLSearchParams(options).toString();
    return `${rootUrl}?${qs}`;
  }

  getButtonMenu(position: number): TelegramBot.InlineKeyboardButton[][] {
    return [
      [
        {
          text: '💼 Wallet ' + position,
          callback_data: 'wallet_setting',
        },
        {
          text: '🏆 Ranking',
          callback_data: 'root_ranking',
        },
      ],
      [
        {
          text: '🚀 Transfer',
          callback_data: 'root_transfer',
        },
        {
          text: '🔁 Swap (Buy/Sell)',
          callback_data: 'root_swap',
        },
      ],
      [
        {
          text: '✅ Social Task',
          callback_data: 'root_social_task',
        },
        {
          text: '✅ Daily Task',
          callback_data: 'root_daily_task',
        },
      ],
      [
        {
          text: '🎮 xCenGame | Coming soon',
          callback_data: 'root_game',
        },
        {
          text: '🎰 Convert xCEN | Coming soon',
          callback_data: 'root_convert',
        },
      ],
      [
        {
          text: '🖼️ NFT | Coming soon',
          callback_data: 'root_nft',
        },
        {
          text: '👦 Referral',
          callback_data: 'root_referral',
        },
      ],
      [
        {
          text: 'Market Insight',
          callback_data: 'root_market_insight',
        },
        { text: 'Snipers', callback_data: 'root_sniper' },
      ],
      [
        {
          text: '⚙️ Setting',
          callback_data: 'root_setting',
        },
        {
          text: '🔁 Refresh Menu',
          callback_data: 'refresh_menu',
        },
      ],
    ];
  }

  getCodeVerified() {
    const genCode = nanoid.customAlphabet(
      '1234567890abcdefghijklmnopqrstuvwxyz',
    );
    return genCode(8);
  }
}

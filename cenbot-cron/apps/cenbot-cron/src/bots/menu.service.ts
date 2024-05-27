import { HttpService } from '@nestjs/axios';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { replaceText, replaceTextItalic } from '../utils/convert';
import { getAllBalances } from '../utils/trade';
import { ISuiScan } from './types/type.coins';
import {
  IAutoSniper,
  IInsightPool,
  IRootSniper,
  ISwapBUY,
  ITokenMarket,
  ITokenSniper,
  TTransSUI,
  TTransTOKEN,
} from './types/type.menu';

@Injectable()
export class MenuServices {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async transferSUI(props: TTransSUI) {
    try {
      props.bot.editMessageText(
        replaceText(props.text + '💸 *Transfer SUI* 💸'),
        {
          chat_id: props.message.chat.id,
          message_id: props.message.message_id,
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
              ...props.function(props.indexFrom, 'transfer_from'),
              [
                {
                  text: '⬜️ TO WALLET ⬜️',
                  callback_data: 'to_wallet',
                },
              ],
              ...props.function(props.indexTo, 'transfer_to'),
              [
                {
                  text: 'Custom Wallet: --',
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
                  text: (props.AMOUNT.includes('0.1') ? '✅ ' : '') + '0.1 SUI',
                  callback_data: 'transfer_amount_0.1',
                },
                {
                  text: (props.AMOUNT.includes('0.3') ? '✅ ' : '') + '0.3 SUI',
                  callback_data: 'transfer_amount_0.3',
                },
                {
                  text: (props.AMOUNT.includes('0.5') ? '✅ ' : '') + '0.5 SUI',
                  callback_data: 'transfer_amount_0.5',
                },
              ],
              [
                {
                  text: 'Set: --',
                  callback_data: 'transfer_set_amount',
                },
                {
                  text:
                    (props.AMOUNT.includes('all') ? '✅ ' : '') +
                    `All: ${props.total} SUI`,
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
    } catch (error) {
      console.log('transfer-sui:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }

  async transferTOKEN(props: TTransTOKEN) {
    try {
      const wallet_choose = props.wallets[props.indexFrom - 1];
      const coins = await getAllBalances(wallet_choose.privateKey);
      const list_token_transfer = [];
      let menuListToken = '';

      for (const [key, value] of Object.entries(props.TYPE_COIN)) {
        const coin = coins.find((co) => co?.coinType === value);

        if (coin) {
          const amount = (+coin.totalBalance / Math.pow(10, coin.del)).toFixed(
            4,
          );
          menuListToken += `\n• *${key}*: \`${amount}\``;
          list_token_transfer.push({
            text: (props.TOKEN.includes(key.toLowerCase()) ? '✅ ' : '') + key,
            callback_data: `transfer_${key.toLowerCase()}_tokens`,
          });
        }
      }
      const listTokenConvertMenu = [];
      if (list_token_transfer.length > 3) {
        for (let i = 0; i < Math.ceil(list_token_transfer.length / 3); i++) {
          listTokenConvertMenu.push([]);
          for (let j = 0; j < 3; j++) {
            if (3 * i + j < list_token_transfer.length)
              listTokenConvertMenu[i].push(list_token_transfer[3 * i + j]);
          }
        }
      } else {
        listTokenConvertMenu.push(list_token_transfer);
      }

      props.bot.editMessageText(
        replaceText(props.text + '💸 *Transfer TOKEN* 💸' + menuListToken),
        {
          chat_id: props.message.chat.id,
          message_id: props.message.message_id,
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
              ...props.function(props.indexFrom, 'transfer_from'),
              [
                {
                  text: '⬜️ TO WALLET ⬜️',
                  callback_data: 'to_wallet',
                },
              ],
              ...props.function(props.indexTo, 'transfer_to'),
              [
                {
                  text: 'Custom Wallet: --',
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
                    (props.PERCENT.includes('percent_0.25') ? ' ✅' : ''),
                  callback_data: 'transfer_percent_0.25',
                },
                {
                  text:
                    '50%' +
                    (props.PERCENT.includes('percent_0.5') ? ' ✅' : ''),
                  callback_data: 'transfer_percent_0.5',
                },
                {
                  text:
                    '100%' + (props.PERCENT.includes('percent_1') ? ' ✅' : ''),
                  callback_data: 'transfer_percent_1',
                },
              ],
              [
                {
                  text: '📝 Select Token 📝',
                  callback_data: 'transfer_select_token',
                },
              ],
              ...listTokenConvertMenu,
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
    } catch (error) {
      console.log('transfer-token:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }

  async swapBUY(props: ISwapBUY) {
    try {
      const type_coin_change = props.ActionsSWAP.TYPE[props.message.chat.id]
        .split('_')[1]
        .toUpperCase();
      const wallet_choose =
        props.wallets[
          +props.ActionsSWAP.WALLET[props.message.chat.id].split('_')[2] - 1
        ];

      const listCoin = [];
      const listToken = [];
      let menuListToken = '';
      const coins = await getAllBalances(wallet_choose.privateKey);
      for (const [key, value] of Object.entries(props.TYPE_COIN)) {
        const coin = coins.find((co) => co?.coinType === value);
        listToken.push({
          text:
            (props.ActionsSWAP.TOKEN[props.message.chat.id].split('_')[2] ===
              key.toLowerCase() &&
            props.ActionsSWAP.CUSTOM_TOKEN[props.message.chat.id] === ''
              ? '✅ '
              : '') + key,
          callback_data: `swap_token_${key.toLowerCase()}`,
        });

        if (coin) {
          const amount = (+coin.totalBalance / Math.pow(10, coin.del)).toFixed(
            4,
          );
          menuListToken += `\n• *${key}*: \`${amount}\``;
          listCoin.push({
            coinType: value,
            symbol: key,
            data: `swap_${key.toLowerCase()}_type`,
            amount,
          });
        }
      }
      const listCoinMap = listCoin.map((coin) => ({
        text:
          (props.ActionsSWAP.TYPE[props.message.chat.id] === coin.data
            ? '✅ '
            : '') + `${coin.symbol}: ${coin.amount}`,
        callback_data: coin.data,
      }));
      const listCoinConvert = [];
      if (listCoinMap.length > 3) {
        for (let i = 0; i < Math.ceil(listCoinMap.length / 3); i++) {
          listCoinConvert.push([]);
          for (let j = 0; j < 3; j++) {
            if (3 * i + j < listCoinMap.length)
              listCoinConvert[i].push(listCoinMap[3 * i + j]);
          }
        }
      } else {
        listCoinConvert.push(listCoinMap);
      }

      const convertListToken = [];
      if (listToken.length > 3) {
        for (let i = 0; i < Math.ceil(listToken.length / 3); i++) {
          convertListToken.push([]);
          for (let j = 0; j < 3; j++) {
            if (3 * i + j < listToken.length)
              convertListToken[i].push(listToken[3 * i + j]);
          }
        }
      } else {
        convertListToken.push(listToken);
      }

      const textMenu = `➕ *Buy Tokens* ➕\n\n═⛽️ *Token list* ═${menuListToken}\n\n═⛽️ *Gas Settings* | \\[[Info](https://www.google.com/)\\] ═\n\n•🔬 *Aggregation*: For all swaps, we compare quotes from aggregators and simulate results to maximize your trades.\n• 🌟 Easy Mode automatically use the safest and optimal settings for your swaps, ensuring that you receive the best price possible.`;

      const positionWallet =
        props.ActionsSWAP.WALLET[props.message.chat.id].split('_')[2];

      const swap_token = props.ActionsSWAP.TOKEN[props.message.chat.id]
        .split('_')[2]
        .toUpperCase();
      const swap_type_token =
        props.ActionsSWAP.CUSTOM_TOKEN[props.message.chat.id] === ''
          ? props.TYPE_COIN[swap_token]
          : props.ActionsSWAP.CUSTOM_TOKEN[props.message.chat.id];

      const [_address, _low, _up] = swap_type_token?.split('::');
      const convert_address =
        _address.length > 30
          ? _address.slice(0, 7) + '...' + _address.slice(-5)
          : _address;
      const convert = `${convert_address}::${_low}::${_up}`;

      return props.bot.editMessageText(replaceText(props.text + textMenu), {
        chat_id: props.message.chat.id,
        message_id: props.message.message_id,
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
            ...props.function(+positionWallet, 'swap'),

            [
              {
                text: '⬜️ BUY WITH ⬜️',
                callback_data: 'swap_with',
              },
            ],
            ...listCoinConvert,
            [
              {
                text: '⬜️ BUY AMOUNT ⬜️',
                callback_data: 'swap_amount',
              },
            ],
            [
              {
                text:
                  (props.ActionsSWAP.CUSTOM_AMOUNT[props.message.chat.id] ===
                    '' &&
                  props.ActionsSWAP.AMOUNT[props.message.chat.id].includes(
                    'amount_0.1',
                  )
                    ? '✅ '
                    : '') + `0.1 ${type_coin_change}`,
                callback_data: 'swap_amount_0.1',
              },
              {
                text:
                  (props.ActionsSWAP.CUSTOM_AMOUNT[props.message.chat.id] ===
                    '' &&
                  props.ActionsSWAP.AMOUNT[props.message.chat.id].includes(
                    'amount_0.5',
                  )
                    ? '✅ '
                    : '') + `0.5 ${type_coin_change}`,
                callback_data: 'swap_amount_0.5',
              },
              {
                text:
                  (props.ActionsSWAP.CUSTOM_AMOUNT[props.message.chat.id] !== ''
                    ? '✅ '
                    : '') +
                  `✎${
                    props.ActionsSWAP.CUSTOM_AMOUNT[props.message.chat.id] ||
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
                  (props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] ===
                    '' &&
                  props.ActionsSWAP.SLIPPAGE[props.message.chat.id].includes(
                    'slippage_auto',
                  )
                    ? '✅ '
                    : '') + 'Auto',
                callback_data: 'swap_slippage_auto',
              },
              {
                text:
                  (props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] ===
                    '' &&
                  props.ActionsSWAP.SLIPPAGE[props.message.chat.id].includes(
                    'slippage_3',
                  )
                    ? '✅ '
                    : '') + '3%',
                callback_data: 'swap_slippage_3',
              },
              {
                text:
                  (props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] !== ''
                    ? '✅ '
                    : '') +
                  `✎${props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] || 10}%`,
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
                text: 'Custom Token: ',
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
      });
    } catch (error) {
      console.log('swap-buy-token:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .catch(() => {
          return;
        })
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }

  async swapSELL(props: ISwapBUY) {
    try {
      const type_coin_change = props.ActionsSWAP.TYPE[props.message.chat.id]
        .split('_')[1]
        .toUpperCase();
      const wallet_choose =
        props.wallets[
          +props.ActionsSWAP.WALLET[props.message.chat.id].split('_')[2] - 1
        ];

      const listCoin = [];
      const listToken = [];
      let menuListToken = '';
      const coins = await getAllBalances(wallet_choose.privateKey);

      for (const [key, value] of Object.entries(props.TYPE_COIN)) {
        const coin = coins.find((co) => co?.coinType === value);
        listToken.push({
          text:
            (props.ActionsSWAP.TOKEN[props.message.chat.id].split('_')[2] ===
              key.toLowerCase() &&
            props.ActionsSWAP.CUSTOM_TOKEN[props.message.chat.id] === ''
              ? '✅ '
              : '') + key,
          callback_data: `swap_token_${key.toLowerCase()}`,
        });

        if (coin) {
          const amount = (+coin.totalBalance / Math.pow(10, coin.del)).toFixed(
            4,
          );
          menuListToken += `\n• *${key}*: \`${amount}\``;
          listCoin.push({
            coinType: value,
            symbol: key,
            data: `swap_${key.toLowerCase()}_type`,
            amount,
          });
        }
      }
      const listCoinMap = listCoin.map((coin) => ({
        text:
          (props.ActionsSWAP.TYPE[props.message.chat.id] === coin.data
            ? '✅ '
            : '') + `${coin.symbol}: ${coin.amount}`,
        callback_data: coin.data,
      }));
      const listCoinConvert = [];
      if (listCoinMap.length > 3) {
        for (let i = 0; i < Math.ceil(listCoinMap.length / 3); i++) {
          listCoinConvert.push([]);
          for (let j = 0; j < 3; j++) {
            if (3 * i + j < listCoinMap.length)
              listCoinConvert[i].push(listCoinMap[3 * i + j]);
          }
        }
      } else {
        listCoinConvert.push(listCoinMap);
      }

      const convertListToken = [];
      if (listToken.length > 3) {
        for (let i = 0; i < Math.ceil(listToken.length / 3); i++) {
          convertListToken.push([]);
          for (let j = 0; j < 3; j++) {
            if (3 * i + j < listToken.length)
              convertListToken[i].push(listToken[3 * i + j]);
          }
        }
      } else {
        convertListToken.push(listToken);
      }

      const textMenu = `➕ *Sell Tokens* ➕\n\n═⛽️ *Token list* ═${menuListToken}\n\n═⛽️ *Gas Settings* | \\[[Info](https://www.google.com/)\\] ═\n\n•🔬 *Aggregation*: For all swaps, we compare quotes from aggregators and simulate results to maximize your trades.\n• 🌟 Easy Mode automatically use the safest and optimal settings for your swaps, ensuring that you receive the best price possible.`;

      const positionWallet =
        props.ActionsSWAP.WALLET[props.message.chat.id].split('_')[2];

      if (props.send) {
        return props.bot.sendMessage(
          props.message.chat.id,
          replaceText(props.text + textMenu),
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
                ...props.function(+positionWallet, 'swap'),
                [
                  {
                    text: '⬜️ SELL TOKEN ⬜️',
                    callback_data: 'swap_with',
                  },
                ],
                ...listCoinConvert,
                [
                  {
                    text: '⬜️ SELECT AMOUNT ⬜️',
                    callback_data: 'swap_amount',
                  },
                ],
                [
                  {
                    text:
                      (props.ActionsSWAP.CUSTOM_AMOUNT[
                        props.message.chat.id
                      ] === '' &&
                      props.ActionsSWAP.AMOUNT[props.message.chat.id].includes(
                        'amount_0.1',
                      )
                        ? '✅ '
                        : '') + `0.1 ${type_coin_change}`,
                    callback_data: 'swap_amount_0.1',
                  },
                  {
                    text:
                      (props.ActionsSWAP.CUSTOM_AMOUNT[
                        props.message.chat.id
                      ] === '' &&
                      props.ActionsSWAP.AMOUNT[props.message.chat.id].includes(
                        'amount_0.5',
                      )
                        ? '✅ '
                        : '') + `0.5 ${type_coin_change}`,
                    callback_data: 'swap_amount_0.5',
                  },
                  {
                    text:
                      (props.ActionsSWAP.CUSTOM_AMOUNT[
                        props.message.chat.id
                      ] !== ''
                        ? '✅ '
                        : '') +
                      `✎${
                        props.ActionsSWAP.CUSTOM_AMOUNT[
                          props.message.chat.id
                        ] || 0.25
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
                      (props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] ===
                        '' &&
                      props.ActionsSWAP.SLIPPAGE[
                        props.message.chat.id
                      ].includes('slippage_auto')
                        ? '✅ '
                        : '') + 'Auto',
                    callback_data: 'swap_slippage_auto',
                  },
                  {
                    text:
                      (props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] ===
                        '' &&
                      props.ActionsSWAP.SLIPPAGE[
                        props.message.chat.id
                      ].includes('slippage_3')
                        ? '✅ '
                        : '') + '3%',
                    callback_data: 'swap_slippage_3',
                  },
                  {
                    text:
                      (props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] ===
                        '' &&
                      props.ActionsSWAP.SLIPPAGE[
                        props.message.chat.id
                      ].includes('slippage_custom')
                        ? '✅ '
                        : '') +
                      `✎${props.ActionsSWAP[props.message.chat.id].CUSTOM_SLIP || 10}%`,
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
      return props.bot.editMessageText(replaceText(props.text + textMenu), {
        chat_id: props.message.chat.id,
        message_id: props.message.message_id,
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
            ...props.function(+positionWallet, 'swap'),
            [
              {
                text: '⬜️ SELL TOKEN ⬜️',
                callback_data: 'swap_with',
              },
            ],
            ...listCoinConvert,
            [
              {
                text: '⬜️ SELECT AMOUNT ⬜️',
                callback_data: 'swap_amount',
              },
            ],
            [
              {
                text:
                  (props.ActionsSWAP.CUSTOM_AMOUNT[props.message.chat.id] ===
                    '' &&
                  props.ActionsSWAP.AMOUNT[props.message.chat.id].includes(
                    'amount_0.1',
                  )
                    ? '✅ '
                    : '') + `0.1 ${type_coin_change}`,
                callback_data: 'swap_amount_0.1',
              },
              {
                text:
                  (props.ActionsSWAP.CUSTOM_AMOUNT[props.message.chat.id] ===
                    '' &&
                  props.ActionsSWAP.AMOUNT[props.message.chat.id].includes(
                    'amount_0.5',
                  )
                    ? '✅ '
                    : '') + `0.5 ${type_coin_change}`,
                callback_data: 'swap_amount_0.5',
              },
              {
                text:
                  (props.ActionsSWAP.CUSTOM_AMOUNT[props.message.chat.id] !== ''
                    ? '✅ '
                    : '') +
                  `✎${
                    props.ActionsSWAP.CUSTOM_AMOUNT[props.message.chat.id] ||
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
                  (props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] ===
                    '' &&
                  props.ActionsSWAP.SLIPPAGE[props.message.chat.id].includes(
                    'slippage_auto',
                  )
                    ? '✅ '
                    : '') + 'Auto',
                callback_data: 'swap_slippage_auto',
              },
              {
                text:
                  (props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] ===
                    '' &&
                  props.ActionsSWAP.SLIPPAGE[props.message.chat.id].includes(
                    'slippage_3',
                  )
                    ? '✅ '
                    : '') + '3%',
                callback_data: 'swap_slippage_3',
              },
              {
                text:
                  (props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] ===
                    '' &&
                  props.ActionsSWAP.SLIPPAGE[props.message.chat.id].includes(
                    'slippage_custom',
                  )
                    ? '✅ '
                    : '') +
                  `✎${props.ActionsSWAP.CUSTOM_SLIP[props.message.chat.id] || 10}%`,
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
      });
    } catch (error) {
      console.log('swap-sell-token:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .catch(() => {
          return;
        })
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }

  async tokenMarket(props: ITokenMarket) {
    try {
      const wallet_choose = props.wallets[props.position];

      const suiScan = await this.httpService.axiosRef.post(
        this.configService
          .getOrThrow<string>('API_TOKEN_PRICE')
          .replace('{address}', wallet_choose.address),
        { objectTypes: ['coins', 'nfts', 'others'] },
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
          },
        },
      );
      // console.log({ coin: suiScan.data.coins, nft: suiScan.data.nfts });

      const nfts = {
        data: suiScan.data.nfts,
        length:
          suiScan.data.nfts
            .map((nft) => nft.name.trim().length)
            .sort((a, b) => b - a)[0]! || 0,
      };

      const convertText = (text: string, number = 10) => {
        return (
          text +
          Array.from({ length: number - text.length }, () => ' ').join('')
        );
      };
      const convertTextAfter = (text: string, number = 10) => {
        return (
          Array.from({ length: number - text.length }, () => ' ').join('') +
          text
        );
      };
      const convertPrice = (price: number, number = 7) => {
        const int = Math.ceil(price).toString().length;
        if (int < 7) return price.toFixed(number - int - 1);
        return convertText(price.toString(), 7);
      };
      const formatCash = (money: number) =>
        Intl.NumberFormat('en-US', {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(money);

      const convertCoins = suiScan.data.coins
        .filter((coin) => coin.totalBalance > 0)
        .sort((a, b) => +b.tokenPrice - +a.tokenPrice)
        .map((coin: ISuiScan) => {
          const balance = coin.totalBalance / Math.pow(10, coin.decimals);
          const price = coin.tokenPrice * balance;
          return {
            type: coin.type,
            symbol: coin.symbol,
            balance: balance.toFixed(4),
            totalBalance: coin.totalBalance,
            price,
            name: coin.name,
            symText: convertText(coin.symbol, 8),
            symPrice: convertPrice(price),
          };
        });

      const totalPrice = convertCoins
        .filter((token) => token.price && token.price > 0)
        .reduce((acc, curr) => acc + curr.price, 0)
        .toFixed(4);

      const listEmpty = `=> <i>List Empty</i>\n`;
      const textTokens = `═️ <b>Tokens List</b> ═\n`;
      const textWallet = `══ <b>Your Market</b> ══\n▰ <a href="https://suiexplorer.com/address/${wallet_choose.address}">Wallet-w${props.position + 1}</a> ▰   $${totalPrice}\n<code>${wallet_choose.address}</code>\n\n`;

      const textListToken = `<pre>  | ID | Symbol   | Price $ | Balance |  
  |----|----------|---------|---------|  
${convertCoins.map((coin, idx) => `  | ${convertTextAfter((idx + 1).toString(), 2)} | ${coin.symText} | ${coin.symPrice} | ${convertTextAfter(formatCash(coin.totalBalance), 7)} |  `).join('\n')}
  |----|----------|---------|---------|  
</pre>
`;
      const textNFTS = `═️ <b>NFTs List</b> ═\n`;
      const textListNFTS = `<pre>  | ID | ${convertText('Name', nfts.length)} | Amount | Oject |  
  |----|${Array.from({ length: nfts.length + 3 }).join('-')}|--------|-------|  
${nfts.data.map((nft, idx) => `  | ${convertTextAfter((idx + 1).toString(), 2)} | ${convertText(nft.name.toString(), nfts.length)} | ${convertTextAfter(nft.amount.toString(), 6)} | ${convertTextAfter(nft.objectCount.toString(), 5)} |  `).join('\n')}
  |----|${Array.from({ length: nfts.length + 3 }).join('-')}|--------|-------|  
</pre>
`;

      new Promise(() => {
        for (let i = 0; i < 151; i++) {
          props.bot
            .deleteMessage(
              props.message.chat.id,
              props.message.message_id + 50 - i,
            )
            .catch(() => {
              return;
            });
        }
        return true;
      }).catch((error) => {
        console.log('error delete message', error.message);
        return;
      });

      props.bot.sendMessage(
        props.message.chat.id,
        props.text +
          textWallet +
          textTokens +
          (convertCoins.length > 0 ? textListToken : listEmpty) +
          textNFTS +
          (nfts.data.length > 0 ? textListNFTS : listEmpty),
        {
          disable_web_page_preview: true,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⬜️ SELECT WALLET ⬜️',
                  callback_data: 'market_insight_select_wallet',
                },
              ],
              ...props.function(props.position + 1, 'market'),
              [
                { text: '🔙️ Back', callback_data: 'root_market_insight' },
                { text: '⏪ Main menu', callback_data: 'edit_menu' },
              ],
            ],
          },
        },
      );
    } catch (error) {
      console.log('error menu user market:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .catch(() => {
          return;
        })
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }

  async insightGainers(props: IInsightPool) {
    try {
      const convertText = (text: string, number = 10) => {
        return (
          text +
          Array.from({ length: number - text.length }, () => ' ').join('')
        );
      };
      const convertTextAfter = (text: string, number = 10) => {
        return (
          Array.from({ length: number - text.length }, () => ' ').join('') +
          text
        );
      };

      const tokensMenu = props.topInsights.map((token) => ({
        text: token.symbol,
        callback_data: `insight_token_gainer_${token.index}`,
      }));
      const convertListToken = [];
      if (tokensMenu.length > 3) {
        for (let i = 0; i < Math.ceil(tokensMenu.length / 3); i++) {
          convertListToken.push([]);
          for (let j = 0; j < 3; j++) {
            if (3 * i + j < tokensMenu.length)
              convertListToken[i].push(tokensMenu[3 * i + j]);
          }
        }
      } else {
        convertListToken.push(tokensMenu);
      }

      const textMenu = `═️ <b>Top Gainers last 24H (All time)</b> ═\n`;
      const textTable = `<pre>  | ID | Tokens        | Price      |   Change |  
  |----|---------------|------------|----------|  
${props.topInsights.map((item, index) => `  | ${convertTextAfter((index + 1).toString(), 2)} | ${convertText(item.symbol, 13)} | ${convertText(item.price, 10)} | ${convertTextAfter(item['24h'], 8)} |  `).join('\n')}
  |----|---------------|------------|----------|  
</pre>`;

      new Promise(() => {
        for (let i = 0; i < 151; i++) {
          props.bot
            .deleteMessage(
              props.message.chat.id,
              props.message.message_id + 50 - i,
            )
            .catch(() => {
              return;
            });
        }
        return true;
      }).catch((error) => {
        console.log('error delete message', error.message);
        return;
      });

      props.bot.sendMessage(
        props.message.chat.id,
        props.text + textMenu + textTable,
        {
          disable_web_page_preview: true,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⬜️ VIEW DETAIL TOKEN ⬜️',
                  callback_data: 'market_insight_detail_token',
                },
              ],
              ...convertListToken,
              [
                { text: '🔙️ Back', callback_data: 'root_market_insight' },
                { text: '⏪ Main menu', callback_data: 'edit_menu' },
              ],
            ],
          },
        },
      );
    } catch (error) {
      console.log('error insight top gainers:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .catch(() => {
          return;
        })
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }

  async insightPools(props: IInsightPool) {
    try {
      const convertText = (text: string, number = 10) => {
        return (
          text +
          Array.from({ length: number - text.length }, () => ' ').join('')
        );
      };
      const convertTextAfter = (text: string, number = 10) => {
        return (
          Array.from({ length: number - text.length }, () => ' ').join('') +
          text
        );
      };

      const tokensMenu = props.topInsights.map((token) => ({
        text: token.symbol,
        callback_data: `insight_token_pool_${token.index}`,
      }));
      const convertListToken = [];
      if (tokensMenu.length > 3) {
        for (let i = 0; i < Math.ceil(tokensMenu.length / 3); i++) {
          convertListToken.push([]);
          for (let j = 0; j < 3; j++) {
            if (3 * i + j < tokensMenu.length)
              convertListToken[i].push(tokensMenu[3 * i + j]);
          }
        }
      } else {
        convertListToken.push(tokensMenu);
      }

      const textMenu = `═️ <b>Top Pools last 24H (All time)</b> ═\n`;
      const textTable = `<pre>  | ID | Tokens         | Price      |     TVL |  
  |----|----------------|------------|---------|  
${props.topInsights.map((item, idx) => `  | ${convertTextAfter((idx + 1).toString(), 2)} | ${convertText(item.symbol, 14)} | ${convertText(item.price, 10)} | ${convertTextAfter(item.volume, 7)} |  `).join('\n')}
  |----|----------------|------------|---------|  
</pre>`;

      new Promise(() => {
        for (let i = 0; i < 121; i++) {
          props.bot
            .deleteMessage(
              props.message.chat.id,
              props.message.message_id + 20 - i,
            )
            .catch(() => {
              return;
            });
        }
        return true;
      }).catch((error) => {
        console.log('error delete message', error.message);
        return;
      });

      props.bot.sendMessage(
        props.message.chat.id,
        props.text + textMenu + textTable,
        {
          disable_web_page_preview: true,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⬜️ VIEW DETAIL TOKEN ⬜️',
                  callback_data: 'market_insight_detail_token',
                },
              ],
              ...convertListToken,
              [
                { text: '🔙️ Back', callback_data: 'root_market_insight' },
                { text: '⏪ Main menu', callback_data: 'edit_menu' },
              ],
            ],
          },
        },
      );
    } catch (error) {
      console.log('error insight top pools:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .catch(() => {
          return;
        })
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }

  async tokenSniper(props: ITokenSniper) {
    try {
      const listWalletSniper = props.wallets.filter((item) =>
        props.walletToken.includes(item.address),
      );

      const listPosition = listWalletSniper.map(
        (item) =>
          props.wallets.findIndex((wal) => wal.address === item.address) + 1,
      );

      const rewrite = (wallet: string) =>
        wallet.slice(0, 17) + '...' + wallet.slice(-15);

      const textToken =
        props.sniperToken.length > 0
          ? `*Tokens List:*\n${props.sniperToken.map((token) => `• \`${rewrite(token)}\`\n`).join('')}`
          : '*Tokens List:*\n_Your token list is empty._';

      const menuButton = [
        [
          { text: 'Sniper Menu', callback_data: 'root_sniper' },
          { text: '⏪ Main menu', callback_data: 'edit_menu' },
          { text: '✖️ Close', callback_data: 'close_current' },
        ],
        [
          {
            text: '⬜️ SNIPER ON/OFF ⬜️',
            callback_data: 'token_sniper_on_off',
          },
        ],
        ...props.function(listPosition, 'token_sniper'),

        [{ text: '⬜️ SNIPER SETUP ⬜️', callback_data: 'sniper_setup' }],
        [
          {
            text: `Max Spend Amt: ${props.maxSpend || '✎'} SUI`,
            callback_data: 'token_add_max_spend',
          },
        ],
        [
          {
            text: `${props.autoSell && props.autoSell !== 'OFF' ? '✅' : '❌'} Autosell: ${props.autoSell && props.autoSell !== 'OFF' ? props.autoSell : '✎ OFF'}`,
            callback_data: 'token_toggle_auto_sell',
          },
        ],
        [
          {
            text: `${props.firstFail ? '✅' : '❌'} First of Fail`,
            callback_data: 'token_toggle_first_fail',
          },
          {
            text: `${props.antiRug ? '✅' : '❌'} Anti-Rug`,
            callback_data: 'token_toggle_anti_rug',
          },
        ],
        [
          {
            text: '🎯 Add Token To Snipe 🎯',
            callback_data: 'token_add_sniper',
          },
        ],
      ];

      if (!props.send) {
        props.bot.editMessageText(
          replaceText(props.text) + replaceTextItalic(textToken),
          {
            chat_id: props.message.chat.id,
            message_id: props.message.message_id,
            disable_web_page_preview: true,
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: menuButton },
          },
        );
      } else {
        props.bot.sendMessage(
          props.message.chat.id,
          replaceText(props.text) + replaceTextItalic(textToken),
          {
            disable_web_page_preview: true,
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: menuButton },
          },
        );
      }
    } catch (error) {
      console.log('error menu token market:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .catch(() => {
          return;
        })
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }

  async autoSniper(props: IAutoSniper) {
    try {
      const listWalletSniper = props.wallets.filter((item) =>
        props.walletToken.includes(item.address),
      );

      const listPosition = listWalletSniper.map(
        (item) =>
          props.wallets.findIndex((wal) => wal.address === item.address) + 1,
      );

      props.bot.editMessageText(replaceText(props.text), {
        chat_id: props.message.chat.id,
        message_id: props.message.message_id,
        disable_web_page_preview: true,
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Sniper Menu', callback_data: 'root_sniper' },
              { text: '⏪ Main menu', callback_data: 'edit_menu' },
            ],
            [
              {
                text: '⬜️ SNIPER ON/OFF ⬜️',
                callback_data: 'auto_sniper_on_off',
              },
            ],
            ...props.function(listPosition, 'auto_sniper'),
            [{ text: '⬜️ SNIPER SETUP ⬜️', callback_data: 'sniper_setup' }],
            [
              {
                text: `Max Spend Amt: ${props.snipeMaxSpend ?? '✎'} SUI`,
                callback_data: 'auto_snipe_max_spend',
              },
            ],
            [
              {
                text: `${props.snipeAutoSell ? '✅' : '❌'} Autosell: ${props.snipeAutoSell ?? '✎'} OFF`,
                callback_data: 'auto_toggle_auto_sell',
              },
            ],
            [
              {
                text: `${props.snipeAntiRug ? '✅' : '❌'} Anti-Rug`,
                callback_data: 'auto_toggle_anti_rug',
              },
            ],
            [
              {
                text: '🎯 Trigger:✎ ≥10 Snipers 🎯',
                callback_data: 'sniper_setup',
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.log('error menu token market:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .catch(() => {
          return;
        })
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }

  async rootSniper(props: IRootSniper) {
    try {
      const tokenText = props.wallets
        .map(
          (wal, idx) =>
            `\\[[*w${idx + 1}:* ${props.walletTokens.includes(wal.address) ? '🟢' : '🔴'}](${props.uri}?start=sniper_token_w${idx + 1}_${props.message_id})\\]`,
        )
        .join(' ');

      const tokenSnipes = props.wallets.map((wallet) => {
        const snipes = props.tokenSnipe.filter((snipe) =>
          snipe.wallets.includes(wallet.address),
        );
        if (snipes.length === 0) return '';
        return snipes
          .map(
            (snipe) =>
              `\n • *Token:* \`${snipe.token}\`\n*Max spend:* \`${snipe.maxSpend} SUI\` • *Auto sell:* \`${snipe.autoSell}\` • *First of fail:* \`${snipe.firstOfFail}\` • *Anti rug:* \`${snipe.antiRug}\` • `,
          )
          .join('\n');
      });

      const textWalletConvert = props.textWallet
        .split('\n\n')
        .map((wal, idx) => {
          return `${wal}${tokenSnipes[idx] || ''}`;
        })
        .join('\n\n');
      const textMenu = `═🎯  Sniper Menu \\(ERC-20\\)  🎯═\n${textWalletConvert}═ *Running Snipers*: ═\n${tokenText}`;

      props.bot
        .editMessageText(replaceText(props.text + textMenu), {
          chat_id: props.message.chat.id,
          message_id: props.message_id,
          disable_web_page_preview: true,
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔙️ Back', callback_data: 'edit_menu' },
                { text: '✖️ Close', callback_data: 'close_current' },
              ],
              [
                {
                  text: 'Token Sniper Menu',
                  callback_data: 'token_sniper_menu',
                },
              ],
              [{ text: 'Sniped List', callback_data: 'root_sniped_list' }],
            ],
          },
        })
        .catch(() => {
          return;
        });
    } catch (error) {
      console.log('error root sniper menu:', error.message);
      props.bot
        .deleteMessage(props.message.chat.id, props.message.message_id)
        .catch(() => {
          return;
        })
        .finally(() => {
          props.bot.sendMessage(
            props.message.chat.id,
            replaceTextItalic('⚠️ _Something went wrong_ !'),
            { parse_mode: 'MarkdownV2' },
          );
        });
    }
  }
}

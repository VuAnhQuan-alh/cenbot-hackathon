import * as TelegramBot from 'node-telegram-bot-api';

import { Wallets } from '@schema/schema-app/schema/wallets.schema';
import { Snipers } from '@schema/schema-app/schema/sniper.schema';

export type TTransSUI = {
  bot: TelegramBot;
  text: string;
  message: TelegramBot.Message;
  function: (
    check: number,
    pref: string,
  ) => { text: string; callback_data: string }[][];
  indexFrom: number;
  indexTo: number;
  total: number;
  AMOUNT: string;
};

export type TTransTOKEN = {
  wallets: Wallets[];
  bot: TelegramBot;
  text: string;
  message: TelegramBot.Message;
  function: (
    check: number,
    pref: string,
  ) => { text: string; callback_data: string }[][];
  indexFrom: number;
  indexTo: number;
  PERCENT: string;
  AMOUNT: string;
  TOKEN: string;
  TYPE_COIN: any;
};

export type ISwapBUY = {
  wallets: Wallets[];
  bot: TelegramBot;
  text: string;
  message: TelegramBot.Message;
  function: (
    check: number,
    pref: string,
  ) => { text: string; callback_data: string }[][];
  ActionsSWAP: any;
  TYPE_COIN: any;
  send?: boolean;
};

export type ITokenMarket = {
  wallets: Wallets[];
  position: number;
  TYPE_COIN: any;
  bot: TelegramBot;
  text: string;
  message: TelegramBot.Message;
  function: (
    check: number,
    pref: string,
  ) => { text: string; callback_data: string }[][];
};

export type ITokenSniper = {
  wallets: Wallets[];
  bot: TelegramBot;
  text: string;
  message: TelegramBot.Message;
  walletToken: string[];
  sniperToken: string[];
  function: (
    listPosition: number[],
    pref: string,
  ) => { text: string; callback_data: string }[][];
  maxSpend: string | null;
  autoSell: string | null;
  firstFail: boolean;
  antiRug: boolean;
  send: boolean;
};

export type IAutoSniper = {
  wallets: Wallets[];
  bot: TelegramBot;
  text: string;
  message: TelegramBot.Message;
  walletToken: string[];
  sniperToken: string[];
  function: (
    listPosition: number[],
    pref: string,
  ) => { text: string; callback_data: string }[][];
  snipeMaxSpend: string | null;
  snipeAutoSell: string | null;
  snipeAntiRug: boolean;
  send?: boolean;
};

export type IRootSniper = {
  uri: string;
  wallets: Wallets[];
  bot: TelegramBot;
  text: string;
  textWallet: string;
  message: TelegramBot.Message;
  walletTokens: string[];
  walletAutos: string[];
  tokenSnipe: Snipers[];
  message_id: number;
};

export type IInsightPool = {
  bot: TelegramBot;
  text: string;
  message: TelegramBot.Message;
  topInsights: {
    index: number;
    symbol: string;
    price: string;
    '24h': string;
    '6h': string;
    liquidity: string;
    volume: string;
    market: string;
    address: string;
  }[];
};

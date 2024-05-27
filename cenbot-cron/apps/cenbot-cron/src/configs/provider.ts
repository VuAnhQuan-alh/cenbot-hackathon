import BigNumber from 'bignumber.js';

import { SuiClient, SuiHTTPTransport } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

import { Aftermath, AftermathApi, IndexerCaller } from '../sdk/aftermath';
import { BIG_TEN } from './bigNumber';
import { ChainId, DEFAULT_CHAIN_ID } from './chain';

// import * as WebSocket from 'ws';

export const RPC_URLS = {
  [ChainId.DEVNET]: 'https://fullnode.devnet.sui.io:443',
  [ChainId.TESTNET]: 'https://fullnode.testnet.sui.io:443',
  [ChainId.MAINNET]: 'https://fullnode.mainnet.sui.io:443',
  // [ChainId.MAINNET]:
  //   'https://sui-mainnet.blockvision.org/v1/2f7eUT9JHMBBZpzS20S5JEO1kjb',
};

export const provider = new SuiClient({
  url: RPC_URLS[DEFAULT_CHAIN_ID],
});
export const router = new Aftermath('MAINNET').Router();

export const formatSui = (sui: string) => {
  return new BigNumber(sui).dividedBy(BIG_TEN.pow(9)).toString();
};

export const formatPrice = (price: number) => {
  return Math.ceil(price * 1000000) / 1000000;
};

export const wallet = () => new Ed25519Keypair();

const fullnodeEndpoint =
  'https://api.shinami.com/node/v1/sui_mainnet_6b797441066b525fe994fc65bdca8a3b';
export const afApi = new AftermathApi(
  new SuiClient({
    transport: new SuiHTTPTransport({
      url: fullnodeEndpoint,
    }),
  }),
  [],
  new IndexerCaller('MAINNET'),
);

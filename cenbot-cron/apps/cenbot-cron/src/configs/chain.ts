export enum ChainId {
  TESTNET = 0,
  MAINNET = 1,
  DEVNET = 2,
}

export const DEFAULT_CHAIN_ID: ChainId = parseInt(
  process.env.CHAIN_ID || ChainId.MAINNET.toString(),
);

import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';

import { provider, router } from '../configs/provider';
import selectCoinSetWithCombinedBalanceGreaterThanOrEqual from './selectCoin';

export const getInfoAddress = (secretKey: string) => {
  const privateKey = decodeSuiPrivateKey(secretKey);
  const keypair = Ed25519Keypair.fromSecretKey(privateKey.secretKey);

  return {
    address: keypair.toSuiAddress(),
    privateKey,
  };
};

export const getAllBalances = async (secretKey: string) => {
  try {
    const privateKey = decodeSuiPrivateKey(secretKey);
    const keypair = Ed25519Keypair.fromSecretKey(privateKey.secretKey);
    const coins = await provider.getAllBalances({
      owner: keypair.toSuiAddress(),
    });

    const del = coins.map(async (coin) => ({
      del: (await provider.getCoinMetadata({ coinType: coin.coinType }))
        .decimals,
      ...coin,
    }));
    const result = await Promise.all(del);
    // console.log({ coins: result });

    return result;
  } catch (error) {
    console.log('error get all balances:', error.message);
    // throw new Error(error.message);
    return [];
  }
};

export const getCoinBalance = async (secret: string, type: string) => {
  try {
    const list = await getAllBalances(secret);
    return list.find((coin) => coin.coinType === type);
  } catch (error) {
    throw new Error(error.message);
  }
};

export const getBalanceMeta = async (typeCoin: string) => {
  try {
    return await provider.getCoinMetadata({ coinType: typeCoin });
  } catch (error) {
    console.log('error get balance meta:', error.message);
    throw new Error(error.message);
  }
};

export const getPriceSui = async (
  typeIn: string,
  amount: string,
  suiPrice: number,
) => {
  try {
    const route = await router.getCompleteTradeRouteGivenAmountIn({
      coinInType: typeIn,
      coinOutType: '0x2::sui::SUI',
      coinInAmount: BigInt(amount),
    });
    return suiPrice / route.spotPrice;
  } catch (error) {
    console.log('error get price sui:', error.message);
    return 0;
  }
};

export const getOneBalance = async (owner: string) => {
  try {
    return await provider.getBalance({ owner });
  } catch (error) {
    throw new Error(error.message);
  }
};

export const transferCoin = async (
  coinType: string,
  amount: string,
  recipient: string,
  secretKey: string,
) => {
  const privateKey = decodeSuiPrivateKey(secretKey);
  const keypair = Ed25519Keypair.fromSecretKey(privateKey.secretKey);

  if (coinType !== '0x2::sui::SUI') {
    const coins = await provider.getCoins({
      owner: keypair.toSuiAddress(),
      coinType,
    });

    const coinObjects = selectCoinSetWithCombinedBalanceGreaterThanOrEqual(
      coins.data,
      parseInt(amount),
    );

    if (coinObjects.length > 0) {
      const coinObjectIds: string[] = coinObjects.map(
        (obj) => obj.coinObjectId,
      );

      // Construct a new transaction
      const tx = new TransactionBlock();
      if (coinObjectIds.length > 1) {
        tx.mergeCoins(
          tx.object(coinObjectIds[0]),
          coinObjectIds.slice(1).map((obj) => tx.object(obj)),
        );
      }
      const [coin] = tx.splitCoins(tx.object(coinObjectIds[0]), [amount]);
      tx.transferObjects([coin], recipient);

      const txn = await provider.signAndExecuteTransactionBlock({
        signer: keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
        },
      });
      return txn;
    } else {
      return null;
    }
  } else {
    const tx = new TransactionBlock();
    const [coin] = tx.splitCoins(tx.gas, [amount]);
    tx.transferObjects([coin], recipient);

    const txn = await provider.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: tx,
      options: {
        showEffects: true,
      },
    });
    return txn;
  }
};

export const trade = async (
  coinInType: string,
  coinOutType: string,
  coinInAmount: string,
  secretKey: string,
  slippage?: number,
) => {
  const route = await router.getCompleteTradeRouteGivenAmountIn({
    coinInType,
    coinOutType,
    coinInAmount: BigInt(coinInAmount),

    // optional
    referrer:
      '0xc4f39bebfb1a519c5156ff2d5f78de9726ade5ce4de0ae9514027a01ee583c76',
    externalFee: {
      recipient:
        '0xc4f39bebfb1a519c5156ff2d5f78de9726ade5ce4de0ae9514027a01ee583c76',
      feePercentage: 0.001, // 1% fee from amount out
    },
  });

  const privateKey = decodeSuiPrivateKey(secretKey);
  const keypair = Ed25519Keypair.fromSecretKey(privateKey.secretKey);

  const txb = await router.getTransactionForCompleteTradeRoute({
    walletAddress: keypair.toSuiAddress(),
    completeRoute: route,
    slippage: slippage ?? 0.01, // x100 = 1% max slippage
  });
  const txn = await provider.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: txb,
    options: {
      showEffects: true,
    },
  });

  return txn;
};

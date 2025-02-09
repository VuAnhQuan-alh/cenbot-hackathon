import {
  TransactionObjectArgument,
  TransactionBlock,
} from '@mysten/sui.js/transactions';
import {
  Balance,
  RouterExternalFee,
  RouterProtocolName,
  RouterSerializablePool,
  Slippage,
  SuiNetwork,
  UniqueId,
  Url,
  isPoolObject,
  ObjectId,
  SuiAddress,
  isAfSuiRouterPoolObject,
} from '../../../../../types';
import { CoinType } from '../../../../coin/coinTypes';
import AftermathRouterPool from '../routerPools/aftermathRouterPool';
import { AftermathApi } from '../../../../../general/providers';
import { isDeepBookPoolObject } from '../../../../external/deepBook/deepBookTypes';
import DeepBookRouterPool from '../routerPools/deepBookRouterPool';
import { isCetusPoolObject } from '../../../../external/cetus/cetusTypes';
import CetusRouterPool from '../routerPools/cetusRouterPool';
import { isTurbosPoolObject } from '../../../../external/turbos/turbosTypes';
import TurbosRouterPool from '../routerPools/turbosRouterPool';
import InterestRouterPool from '../routerPools/interestRouterPool';
import { isInterestPoolObject } from '../../../../external/interest/interestTypes';
import { isKriyaPoolObject } from '../../../../external/kriya/kriyaTypes';
import KriyaRouterPool from '../routerPools/kriyaRouterPool';
import { isBaySwapPoolObject } from '../../../../external/baySwap/baySwapTypes';
import BaySwapRouterPool from '../routerPools/baySwapRouterPool';
import { isSuiswapPoolObject } from '../../../../external/suiswap/suiswapTypes';
import SuiswapRouterPool from '../routerPools/suiswapRouterPool';
import { isBlueMovePoolObject } from '../../../../external/blueMove/blueMoveTypes';
import BlueMoveRouterPool from '../routerPools/blueMoveRouterPool';
import { isFlowXPoolObject } from '../../../../external/flowX/flowXTypes';
import FlowXRouterPool from '../routerPools/flowXRouterPool';
import AfSuiRouterPool from '../routerPools/afSuiRouterPool';

// =========================================================================
//  Types
// =========================================================================

export interface RouterPoolTradeTxInputs {
  provider: AftermathApi;
  tx: TransactionBlock;
  coinInId: ObjectId | TransactionObjectArgument;
  expectedCoinOutAmount: Balance;
  minAmountOut: Balance;
  coinInType: CoinType;
  coinOutType: CoinType;
  routerSwapCap: TransactionObjectArgument;
  routerSwapCapCoinType: CoinType;
}

// =========================================================================
//  Creation
// =========================================================================

export function createRouterPool(inputs: {
  pool: RouterSerializablePool;
  // NOTE: should this be optional and passed in only upon transaction creation or another way ?
  network: SuiNetwork;
}): RouterPoolInterface {
  const { pool, network } = inputs;

  const constructedPool = isDeepBookPoolObject(pool)
    ? new DeepBookRouterPool(pool, network)
    : isTurbosPoolObject(pool)
      ? new TurbosRouterPool(pool, network)
      : isCetusPoolObject(pool)
        ? new CetusRouterPool(pool, network)
        : isFlowXPoolObject(pool)
          ? new FlowXRouterPool(pool, network)
          : isInterestPoolObject(pool)
            ? new InterestRouterPool(pool, network)
            : isKriyaPoolObject(pool)
              ? new KriyaRouterPool(pool, network)
              : isBaySwapPoolObject(pool)
                ? new BaySwapRouterPool(pool, network)
                : isSuiswapPoolObject(pool)
                  ? new SuiswapRouterPool(pool, network)
                  : isBlueMovePoolObject(pool)
                    ? new BlueMoveRouterPool(pool, network)
                    : isAfSuiRouterPoolObject(pool)
                      ? new AfSuiRouterPool(pool, network)
                      : isPoolObject(pool)
                        ? new AftermathRouterPool(pool, network)
                        : undefined;

  if (!constructedPool)
    throw new Error(`Could not create router pool: ${JSON.stringify(pool)}`);

  // @ts-ignore
  return constructedPool;
}

// =========================================================================
//  Constructor
// =========================================================================

// TODO: use this to make above creation function cleaner

// interface RouterPoolConstructor {
// 	new (
// 		pool: RouterSerializablePool,
// 		network: SuiNetwork
// 	): RouterPoolInterface;
// }

// =========================================================================
//  Interface
// =========================================================================

export interface RouterPoolInterface {
  // =========================================================================
  //  Required
  // =========================================================================

  // =========================================================================
  //  Constants
  // =========================================================================

  readonly protocolName: RouterProtocolName;
  readonly pool: RouterSerializablePool;
  readonly network: SuiNetwork;
  readonly uid: UniqueId;
  readonly expectedGasCostPerHop: Balance; // in SUI
  readonly coinTypes: CoinType[];
  readonly noHopsAllowed: boolean;

  // =========================================================================
  //  Functions
  // =========================================================================

  // NOTE: should this be optional ?
  getSpotPrice: (inputs: {
    coinInType: CoinType;
    coinOutType: CoinType;
  }) => number;

  getTradeAmountOut: (inputs: {
    coinInType: CoinType;
    coinInAmount: Balance;
    coinOutType: CoinType;
    referrer?: SuiAddress;
  }) => Balance;

  tradeTx: (inputs: RouterPoolTradeTxInputs) => TransactionObjectArgument;

  // =========================================================================
  //  Functions
  // =========================================================================

  // =========================================================================
  //  Optional
  // =========================================================================

  // PRODUCTION: make these optional and handle cases

  getTradeAmountIn: (inputs: {
    coinInType: CoinType;
    coinOutAmount: Balance;
    coinOutType: CoinType;
    referrer?: SuiAddress;
  }) => Balance;

  getUpdatedPoolBeforeTrade: (inputs: {
    coinInType: CoinType;
    coinInAmount: Balance;
    coinOutType: CoinType;
    coinOutAmount: Balance;
  }) => RouterPoolInterface;

  getUpdatedPoolAfterTrade: (inputs: {
    coinInType: CoinType;
    coinInAmount: Balance;
    coinOutType: CoinType;
    coinOutAmount: Balance;
  }) => RouterPoolInterface;
}

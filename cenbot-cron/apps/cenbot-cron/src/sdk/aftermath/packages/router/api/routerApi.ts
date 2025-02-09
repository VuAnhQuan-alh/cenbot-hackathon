import { AftermathApi } from '../../../general/providers/aftermathApi';
import { RouterGraph } from '../utils/synchronous/routerGraph';
import {
  Balance,
  CoinType,
  RouterExternalFee,
  RouterCompleteTradeRoute,
  Slippage,
  SuiNetwork,
  Url,
  RouterSerializableCompleteGraph,
  RouterProtocolName,
  UserEventsInputs,
  RouterAsyncSerializablePool,
  isRouterSynchronousProtocolName,
  isRouterAsyncProtocolName,
  SynchronousProtocolsToPoolObjectIds,
  RouterSynchronousOptions,
  AllRouterOptions,
  PartialRouterOptions,
  SuiAddress,
  TxBytes,
  ApiRouterDynamicGasBody,
} from '../../../types';
import {
  TransactionArgument,
  TransactionBlock,
} from '@mysten/sui.js/transactions';
import { DeepBookApi } from '../../external/deepBook/deepBookApi';
import { PoolsApi } from '../../pools/api/poolsApi';
import { CetusApi } from '../../external/cetus/cetusApi';
import { TurbosApi } from '../../external/turbos/turbosApi';
import { RouterApiHelpers } from './routerApiHelpers';
import { InterestApi } from '../../external/interest/interestApi';
import { KriyaApi } from '../../external/kriya/kriyaApi';
import { BaySwapApi } from '../../external/baySwap/baySwapApi';
import { SuiswapApi } from '../../external/suiswap/suiswapApi';
import { BlueMoveApi } from '../../external/blueMove/blueMoveApi';
import { FlowXApi } from '../../external/flowX/flowXApi';
import { Coin } from '../..';
import { IndexerSwapVolumeResponse } from '../../../general/types/castingTypes';

/**
 * RouterApi class provides methods for interacting with the Aftermath Router API.
 * @class
 */
export class RouterApi {
  // =========================================================================
  //  Constants
  // =========================================================================

  private static readonly defaultRouterOptions: AllRouterOptions = {
    regular: {
      synchronous: {
        maxRouteLength: 3,
        tradePartitionCount: 2,
        minRoutesToCheck: 5,
        maxGasCost: BigInt(500_000_000), // 0.5 SUI
      },
      async: {
        tradePartitionCount: 1,
        maxAsyncPoolsPerProtocol: 2,
      },
    },
    preAsync: {
      maxRouteLength: 2,
      tradePartitionCount: 1,
      minRoutesToCheck: 5,
      maxGasCost: BigInt(500_000_000), // 0.5 SUI
      // maxGasCost: BigInt(333_333_333), // 0.333 SUI
    },
  };

  private static readonly constants = {
    dynamicGas: {
      expectedRouterGasCostUpperBound: BigInt(7_000_000), // 0.007 SUI (mainnet)
      slippage: 0.1, // 10%
    },
  };

  // =========================================================================
  //  Class Members
  // =========================================================================

  public readonly Helpers;

  private readonly options;

  // =========================================================================
  //  Constructor
  // =========================================================================

  /**
   * Creates an instance of RouterApi.
   * @constructor
   * @param {AftermathApi} Provider - The Aftermath API instance.
   * @param {RouterProtocolName[]} protocols - The list of protocols to use.
   * @param {PartialRouterOptions} regularOptions - The regular options to use.
   * @param {Partial<RouterSynchronousOptions>} preAsyncOptions - The pre-async options to use.
   */
  constructor(
    private readonly Provider: AftermathApi,
    public readonly protocols: RouterProtocolName[] = ['Aftermath', 'afSUI'],
    regularOptions?: PartialRouterOptions,
    preAsyncOptions?: Partial<RouterSynchronousOptions>,
  ) {
    const optionsToSet: AllRouterOptions = {
      regular: {
        synchronous: {
          ...RouterApi.defaultRouterOptions.regular.synchronous,
          ...regularOptions?.synchronous,
        },
        async: {
          ...RouterApi.defaultRouterOptions.regular.async,
          ...regularOptions?.async,
        },
      },
      preAsync: {
        ...RouterApi.defaultRouterOptions.preAsync,
        ...preAsyncOptions,
      },
    };

    this.options = optionsToSet;

    this.Helpers = new RouterApiHelpers(Provider, optionsToSet);
  }

  // =========================================================================
  //  External Packages
  // =========================================================================

  public Aftermath = () => new PoolsApi(this.Provider);
  public DeepBook = () => new DeepBookApi(this.Provider);
  public Cetus = () => new CetusApi(this.Provider);
  public Turbos = () => new TurbosApi(this.Provider);
  public FlowX = () => new FlowXApi(this.Provider);
  public Interest = () => new InterestApi(this.Provider);
  public Kriya = () => new KriyaApi(this.Provider);
  public BaySwap = () => new BaySwapApi(this.Provider);
  public Suiswap = () => new SuiswapApi(this.Provider);
  public BlueMove = () => new BlueMoveApi(this.Provider);

  // =========================================================================
  //  Public Methods
  // =========================================================================

  // =========================================================================
  //  Inspections
  // =========================================================================

  /**
   * Fetches the total volume of swaps within a specified duration.
   * @param inputs - The inputs for fetching the total volume.
   * @returns A Promise that resolves to an array of total volumes.
   */
  public fetchVolume = async (inputs: { durationMs: number }) => {
    const { durationMs } = inputs;
    return this.Provider.indexerCaller.fetchIndexer<IndexerSwapVolumeResponse>(
      `router/swap-volume/${durationMs}`,
    );
  };

  // =========================================================================
  //  Graph
  // =========================================================================

  public fetchCreateSerializableGraph = async (inputs: {
    asyncPools: RouterAsyncSerializablePool[];
    synchronousProtocolsToPoolObjectIds: SynchronousProtocolsToPoolObjectIds;
  }): Promise<RouterSerializableCompleteGraph> => {
    return this.Helpers.fetchCreateSerializableGraph(inputs);
  };

  public fetchAsyncPools = async (): Promise<RouterAsyncSerializablePool[]> => {
    return this.Helpers.AsyncHelpers.fetchAllPools({
      protocols: this.protocols.filter(isRouterAsyncProtocolName),
    });
  };

  public fetchSynchronousPoolIds =
    async (): Promise<SynchronousProtocolsToPoolObjectIds> => {
      return this.Helpers.SynchronousHelpers.fetchAllPoolIds({
        protocols: this.protocols.filter(isRouterSynchronousProtocolName),
      });
    };

  // =========================================================================
  //  Coin Paths
  // =========================================================================

  public supportedCoinPathsFromGraph = (inputs: {
    graph: RouterSerializableCompleteGraph;
  }) => {
    const maxRouteLength = this.options.regular.synchronous.maxRouteLength;
    return RouterGraph.supportedCoinPathsFromGraph({
      ...inputs,
      maxRouteLength,
    });
  };

  public supportedCoinsFromGraph = (inputs: {
    graph: RouterSerializableCompleteGraph;
  }) => {
    return RouterGraph.supportedCoinsFromGraph(inputs);
  };

  // =========================================================================
  //  Routing
  // =========================================================================

  /**
   * Fetches the complete trade route given an input amount of a specified coin type.
   * @param inputs An object containing the necessary inputs for the trade route calculation.
   * @returns A Promise that resolves to a RouterCompleteTradeRoute object.
   */
  public fetchCompleteTradeRouteGivenAmountIn = async (inputs: {
    network: SuiNetwork;
    graph: RouterSerializableCompleteGraph;
    coinInType: CoinType;
    coinInAmount: Balance;
    coinOutType: CoinType;
    referrer?: SuiAddress;
    externalFee?: RouterExternalFee;
  }): Promise<RouterCompleteTradeRoute> => {
    return this.Helpers.fetchCompleteTradeRouteGivenAmountIn({
      ...inputs,
      protocols: this.protocols,
    });
  };

  /**
   * Fetches the complete trade route given the output amount of the trade.
   * @param inputs - An object containing the necessary inputs for fetching the trade route.
   * @returns A Promise that resolves to a RouterCompleteTradeRoute object.
   */
  public fetchCompleteTradeRouteGivenAmountOut = async (inputs: {
    network: SuiNetwork;
    graph: RouterSerializableCompleteGraph;
    coinInType: CoinType;
    coinOutAmount: Balance;
    coinOutType: CoinType;
    referrer?: SuiAddress;
    externalFee?: RouterExternalFee;
  }): Promise<RouterCompleteTradeRoute> => {
    return this.Helpers.fetchCompleteTradeRouteGivenAmountOut({
      ...inputs,
      protocols: this.protocols,
    });
  };

  // =========================================================================
  //  Transactions
  // =========================================================================

  /**
   * Fetches a transaction for a complete trade route.
   * @param inputs An object containing the wallet address, complete trade route, slippage, and optional sponsored transaction flag.
   * @returns A promise that resolves to a TransactionBlock object.
   */
  public async fetchTransactionForCompleteTradeRoute(inputs: {
    walletAddress: SuiAddress;
    completeRoute: RouterCompleteTradeRoute;
    slippage: Slippage;
    isSponsoredTx?: boolean;
  }): Promise<TransactionBlock> {
    const tx = new TransactionBlock();
    await this.Helpers.fetchTransactionForCompleteTradeRoute({
      ...inputs,
      tx,
      withTransfer: true,
    });
    return tx;
  }

  /**
   * Fetches a transaction argument for a complete trade route.
   * @param inputs An object containing the necessary inputs for the transaction.
   * @returns A promise that resolves to a transaction argument, or undefined if the transaction failed.
   */
  public async fetchAddTransactionForCompleteTradeRoute(inputs: {
    tx: TransactionBlock;
    walletAddress: SuiAddress;
    completeRoute: RouterCompleteTradeRoute;
    slippage: Slippage;
    coinInId?: TransactionArgument;
    isSponsoredTx?: boolean;
  }): Promise<TransactionArgument | undefined> {
    return this.Helpers.fetchTransactionForCompleteTradeRoute(inputs);
  }

  // =========================================================================
  //  Dynamic Gas Helper
  // =========================================================================

  public async fetchAddDynamicGasRouteToTxKind(
    inputs: Omit<ApiRouterDynamicGasBody, 'coinOutAmount'> & {
      coinOutAmount: Balance;
      network: SuiNetwork;
      graph: RouterSerializableCompleteGraph;
    },
  ): Promise<TxBytes> {
    const { gasCoinData } = inputs;

    const tx = TransactionBlock.fromKind(inputs.txKindBytes);

    const completeRoute = await this.fetchCompleteTradeRouteGivenAmountOut({
      ...inputs,
      coinInType: inputs.gasCoinType,
      coinOutType: Coin.constants.suiCoinType,
      coinOutAmount:
        inputs.coinOutAmount +
        RouterApi.constants.dynamicGas.expectedRouterGasCostUpperBound,
    });

    let fullCoinInId: TransactionArgument;
    if ('Coin' in gasCoinData) {
      // coin object has NOT been used previously in tx
      fullCoinInId = tx.object(gasCoinData.Coin);
    } else {
      // coin object has been used previously in tx
      const txArgs = tx.blockData.transactions.reduce(
        (acc, aTx) => [
          ...acc,
          ...('objects' in aTx
            ? aTx.objects
            : 'arguments' in aTx
              ? aTx.arguments
              : 'destination' in aTx
                ? [aTx.destination]
                : 'coin' in aTx
                  ? [aTx.coin]
                  : []),
        ],
        [] as TransactionArgument[],
      );

      fullCoinInId = txArgs.find((arg) => {
        if (!arg) return false;

        // this is here because TS having troubles inferring type for some reason
        // (still being weird)
        const txArg = arg as TransactionArgument;
        return (
          ('Input' in gasCoinData &&
            txArg.kind === 'Input' &&
            txArg.index === gasCoinData.Input) ||
          ('Result' in gasCoinData &&
            txArg.kind === 'Result' &&
            txArg.index === gasCoinData.Result) ||
          ('NestedResult' in gasCoinData &&
            txArg.kind === 'NestedResult' &&
            txArg.index === gasCoinData.NestedResult[0] &&
            txArg.resultIndex === gasCoinData.NestedResult[1])
        );
      });
    }

    // @ts-ignore
    const coinInId = tx.splitCoins(fullCoinInId, [
      tx.pure(completeRoute.coinIn.amount),
    ]);

    const coinOutId = await this.fetchAddTransactionForCompleteTradeRoute({
      tx,
      completeRoute,
      coinInId,
      // TODO: set this elsewhere
      slippage: RouterApi.constants.dynamicGas.slippage,
      walletAddress: inputs.senderAddress,
    });

    // @ts-ignore
    tx.transferObjects([coinOutId], tx.pure(inputs.sponsorAddress));

    const txBytes = await tx.build({
      client: this.Provider.provider,
      onlyTransactionKind: true,
    });
    const b64TxBytes = Buffer.from(txBytes).toString('base64');

    return b64TxBytes;
  }

  // =========================================================================
  //  Events
  // =========================================================================

  /**
   * Fetches trade events for a given user.
   * @param inputs - The inputs for fetching trade events.
   * @returns A Promise that resolves with the fetched trade events.
   */
  public async fetchTradeEvents(inputs: UserEventsInputs) {
    return this.Helpers.SynchronousHelpers.fetchTradeEvents(inputs);
  }
}

import { ConfigAddresses } from '../types/configTypes';
import { PoolsApi } from '../../packages/pools/api/poolsApi';
import { FaucetApi } from '../../packages/faucet/api/faucetApi';
import { CoinApi } from '../../packages/coin/api/coinApi';
import { DynamicFieldsApiHelpers } from '../api/dynamicFieldsApiHelpers';
import { EventsApiHelpers } from '../api/eventsApiHelpers';
import { InspectionsApiHelpers } from '../api/inspectionsApiHelpers';
import { ObjectsApiHelpers } from '../api/objectsApiHelpers';
import { TransactionsApiHelpers } from '../api/transactionsApiHelpers';
import { SuiApi } from '../../packages/sui/api/suiApi';
import { WalletApi } from '../wallet/walletApi';
import { RouterApi } from '../../packages/router/api/routerApi';
import { PlaceholderPricesApi } from '../prices/placeholder/placeholderPricesApi';
import { SuiFrensApi } from '../../packages/suiFrens/api/suiFrensApi';
import { StakingApi } from '../../packages/staking/api/stakingApi';
import { NftAmmApi } from '../../packages/nftAmm/api/nftAmmApi';
import { ReferralVaultApi } from '../../packages/referralVault/api/referralVaultApi';
import {
  CoinType,
  PartialRouterOptions,
  RouterProtocolName,
  RouterSynchronousOptions,
  Url,
} from '../../types';
import { HistoricalDataApi } from '../historicalData/historicalDataApi';
import { CoinGeckoPricesApi } from '../prices/coingecko/coinGeckoPricesApi';
import { PlaceholderHistoricalDataApi } from '../historicalData/placeholderHistoricalDataApi';
import { PerpetualsApi } from '../../packages/perpetuals/api/perpetualsApi';
import { OracleApi } from '../../packages/oracle/api/oracleApi';
import { CoinGeckoCoinApiId } from '../prices/coingecko/coinGeckoTypes';
// import { PriceFeedsApi } from "../priceFeeds/priceFeedsApi";
import { FarmsApi } from '../../packages/farms/api/farmsApi';
import { IndexerCaller } from '../utils';
import { SuiClient } from '@mysten/sui.js/client';
import { DynamicGasApi } from '../dynamicGas/dynamicGasApi';

/**
 * This class represents the Aftermath API and provides helper methods for various functionalities.
 * @class
 */
export class AftermathApi {
  // =========================================================================
  //  Helpers
  // =========================================================================

  public static helpers = {
    // =========================================================================
    //  General
    // =========================================================================

    dynamicFields: DynamicFieldsApiHelpers,
    events: EventsApiHelpers,
    inspections: InspectionsApiHelpers,
    objects: ObjectsApiHelpers,
    transactions: TransactionsApiHelpers,

    // =========================================================================
    //  Utils
    // =========================================================================

    wallet: WalletApi,

    // =========================================================================
    //  General Packages
    // =========================================================================

    coin: CoinApi,
    sui: SuiApi,
  };

  // =========================================================================
  //  Constructor
  // =========================================================================

  /**
   * Creates an instance of AftermathApi.
   * @param provider - The SuiClient instance to use for interacting with the blockchain.
   * @param addresses - The configuration addresses for the Aftermath protocol.
   * @param indexerCaller - The IndexerCaller instance to use for querying the blockchain.
   * @param coinGeckoApiKey - (Optional) The API key to use for querying CoinGecko for token prices.
   */
  public constructor(
    public readonly provider: SuiClient,
    public readonly addresses: ConfigAddresses,
    public readonly indexerCaller: IndexerCaller,
    private readonly coinGeckoApiKey?: string,
  ) {}

  // =========================================================================
  //  Class Object Creation
  // =========================================================================

  // =========================================================================
  //  General
  // =========================================================================

  public DynamicFields = () => new DynamicFieldsApiHelpers(this);
  public Events = () => new EventsApiHelpers(this);
  public Inspections = () => new InspectionsApiHelpers(this);
  public Objects = () => new ObjectsApiHelpers(this);
  public Transactions = () => new TransactionsApiHelpers(this);

  // =========================================================================
  //  Utils
  // =========================================================================

  public Wallet = () => new WalletApi(this);
  public DynamicGas = () => new DynamicGasApi(this);

  public Prices = this.coinGeckoApiKey
    ? (coinApiIdsToCoinTypes: Record<CoinGeckoCoinApiId, CoinType[]>) =>
        new CoinGeckoPricesApi(
          this.coinGeckoApiKey ?? '',
          coinApiIdsToCoinTypes,
        )
    : () => new PlaceholderPricesApi();

  public HistoricalData = this.coinGeckoApiKey
    ? (coinApiIdsToCoinTypes: Record<CoinGeckoCoinApiId, CoinType[]>) =>
        new HistoricalDataApi(this.coinGeckoApiKey ?? '', coinApiIdsToCoinTypes)
    : () => new PlaceholderHistoricalDataApi();

  // public PriceFeeds = new PriceFeedsApi(this.pythPriceServiceEndpoint);

  // =========================================================================
  //  General Packages
  // =========================================================================

  public Coin = () => new CoinApi(this);
  public Sui = () => new SuiApi(this);

  // =========================================================================
  //  Aftermath Packages
  // =========================================================================

  public Pools = () => new PoolsApi(this);
  public Faucet = () => new FaucetApi(this);
  public SuiFrens = () => new SuiFrensApi(this);
  public Staking = () => new StakingApi(this);
  public NftAmm = () => new NftAmmApi(this);
  public ReferralVault = () => new ReferralVaultApi(this);
  public Perpetuals = () => new PerpetualsApi(this);
  public Oracle = () => new OracleApi(this);
  public Farms = () => new FarmsApi(this);

  /**
   * Creates a new instance of the RouterApi class.
   * @param protocols An optional array of protocol names to use for the router.
   * @param regularOptions An optional object containing regular router options.
   * @param preAsyncOptions An optional object containing pre-async router options.
   * @returns A new instance of the RouterApi class.
   */
  public Router = (
    protocols?: RouterProtocolName[],
    regularOptions?: PartialRouterOptions,
    preAsyncOptions?: Partial<RouterSynchronousOptions>,
  ) => new RouterApi(this, protocols, regularOptions, preAsyncOptions);
}

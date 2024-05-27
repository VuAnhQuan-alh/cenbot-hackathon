import { BIG_TEN } from 'apps/cenbot-cron/src/configs/bigNumber';
import { provider } from 'apps/cenbot-cron/src/configs/provider';
import BigNumber from 'bignumber.js';
import * as moment from 'moment';
import { Network, TurbosSdk } from 'turbos-clmm-sdk';

import CetusClmmSDK from '@cetusprotocol/cetus-sui-clmm-sdk';
import { calculateAmountIn } from '@flowx-pkg/ts-sdk';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class DexSdkService {
  // Turbos SDK:
  async swapTurbos(
    address: string,
    poolAddress: string,
    amount: string,
    suiPrice: number,
  ) {
    try {
      const sdk = new TurbosSdk(Network.mainnet);

      const swapResults = await sdk.trade.computeSwapResult({
        pools: [{ pool: poolAddress, a2b: false }],
        address,
        amountSpecified: amount,
        amountSpecifiedIsInput: true,
      });
      const swapResult = swapResults[0];
      const pool = await sdk.pool.getPool(poolAddress);
      const deadline = moment().add(5, 'minutes').unix() * 1000;
      const tx = new TransactionBlock();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);
      tx.moveCall({
        target:
          '0x1a3c42ded7b75cdf4ebc7c7b7da9d1e1db49f16fcdca934fac003f35f39ecad9::swap_router::swap_b_a',
        typeArguments: [pool.types[0], pool.types[1], pool.types[2]],
        arguments: [
          tx.object(poolAddress),
          tx.makeMoveVec({
            objects: [coin],
          }),
          tx.pure(amount),
          tx.pure('0'),
          tx.pure(swapResult.sqrt_price),
          tx.pure(true),
          tx.pure(address),
          tx.pure(deadline.toString()),
          tx.object(
            '0x0000000000000000000000000000000000000000000000000000000000000006',
          ),
          tx.object(
            '0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f',
          ),
        ],
      });
      tx.setSender(address);
      tx.setGasOwner(address);
      tx.build({ client: provider });

      const tokenPriceUSD = new BigNumber(swapResult.amount_b)
        .multipliedBy(suiPrice)
        .dividedBy(swapResult.amount_a);

      return {
        payload: tx,
        price: tokenPriceUSD.toFixed(6).toString(),
        amount: swapResult.amount_a,
      };
    } catch (error) {
      console.log('error function swap turbos:', error.message);
      throw new BadRequestException(error);
    }
  }

  // FlowX SDK:
  async swapFlowX(
    address: string,
    coinOut: { type: string; symbol: string; decimals: number },
    amount: string,
    suiPrice: number,
    tokenDecimal: number,
  ) {
    try {
      const coinIn = {
        type: '0x2::sui::SUI',
        symbol: 'SUI',
        decimals: 9,
      };

      const expiration = moment().add(10, 'minutes').unix() * 1000;
      const tx = new TransactionBlock();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);
      tx.moveCall({
        target:
          '0xba153169476e8c3114962261d1edc70de5ad9781b83cc617ecc8c1923191cae0::router::swap_exact_input',
        typeArguments: [coinIn.type, coinOut.type],
        arguments: [
          tx.object(
            '0x0000000000000000000000000000000000000000000000000000000000000006',
          ),
          tx.object(
            '0xb65dcbf63fd3ad5d0ebfbf334780dc9f785eff38a4459e37ab08fa79576ee511',
          ),
          coin,
          tx.pure('0'),
          tx.pure(address),
          tx.pure(expiration.toString()),
        ],
      });
      tx.setSender(address);
      tx.setGasOwner(address);
      tx.build({ client: provider });

      const data = await calculateAmountIn(
        +amount / Math.pow(10, 9),
        coinIn,
        coinOut,
      ); // 0.02 mean the SUI amount you want to swap
      const amountIn = new BigNumber(data.amountIn.amount)
        .dividedBy(BIG_TEN.pow(9))
        .toString(); // SUI,
      const amountOut = new BigNumber(data.amountOut.amount)
        .dividedBy(BIG_TEN.pow(tokenDecimal))
        .toString(); // Token snipe ,
      const tokenPriceUSD = new BigNumber(amountIn)
        .multipliedBy(suiPrice)
        .dividedBy(amountOut);

      console.log(tx.blockData);
      return {
        payload: tx,
        price: tokenPriceUSD.toFixed(6).toString(),
        amount: amountOut,
      };
    } catch (error) {
      console.log('error function swap flow x:', error.message);
      throw new BadRequestException(error);
    }
  }

  // Swap SDK:
  async swapCetus(
    address: string,
    poolAddress: string,
    coinAmount: string,
    suiPrice: number,
    // tokenDecimal: number,
  ) {
    try {
      const SDKConfig = {
        clmmConfig: {
          pools_id:
            '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
          global_config_id:
            '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
          global_vault_id:
            '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
          admin_cap_id:
            '0x89c1a321291d15ddae5a086c9abc533dff697fde3d89e0ca836c41af73e36a75',
        },
        cetusConfig: {
          coin_list_id:
            '0x8cbc11d9e10140db3d230f50b4d30e9b721201c0083615441707ffec1ef77b23',
          launchpad_pools_id:
            '0x1098fac992eab3a0ab7acf15bb654fc1cf29b5a6142c4ef1058e6c408dd15115',
          clmm_pools_id:
            '0x15b6a27dd9ae03eb455aba03b39e29aad74abd3757b8e18c0755651b2ae5b71e',
          admin_cap_id:
            '0x39d78781750e193ce35c45ff32c6c0c3f2941fa3ddaf8595c90c555589ddb113',
          global_config_id:
            '0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f',
          coin_list_handle:
            '0x49136005e90e28c4695419ed4194cc240603f1ea8eb84e62275eaff088a71063',
          launchpad_pools_handle:
            '0x5e194a8efcf653830daf85a85b52e3ae8f65dc39481d54b2382acda25068375c',
          clmm_pools_handle:
            '0x37f60eb2d9d227949b95da8fea810db3c32d1e1fa8ed87434fc51664f87d83cb',
        },
      };
      const mainnet = {
        ...SDKConfig,
        fullRpcUrl: 'https://sui-mainnet-rpc.allthatnode.com',
        swapCountUrl: 'https://api-sui.cetus.zone/v2/sui/swap/count',
        simulationAccount: { address },
        cetus_config: {
          package_id:
            '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
          published_at:
            '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
          config: {
            coin_list_id:
              '0x8cbc11d9e10140db3d230f50b4d30e9b721201c0083615441707ffec1ef77b23',
            launchpad_pools_id:
              '0x1098fac992eab3a0ab7acf15bb654fc1cf29b5a6142c4ef1058e6c408dd15115',
            clmm_pools_id:
              '0x15b6a27dd9ae03eb455aba03b39e29aad74abd3757b8e18c0755651b2ae5b71e',
            admin_cap_id:
              '0x39d78781750e193ce35c45ff32c6c0c3f2941fa3ddaf8595c90c555589ddb113',
            global_config_id:
              '0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f',
            coin_list_handle:
              '0x49136005e90e28c4695419ed4194cc240603f1ea8eb84e62275eaff088a71063',
            launchpad_pools_handle:
              '0x5e194a8efcf653830daf85a85b52e3ae8f65dc39481d54b2382acda25068375c',
            clmm_pools_handle:
              '0x37f60eb2d9d227949b95da8fea810db3c32d1e1fa8ed87434fc51664f87d83cb',
          },
        },
        clmm_pool: {
          package_id:
            '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
          published_at:
            '0x70968826ad1b4ba895753f634b0aea68d0672908ca1075a2abdf0fc9e0b2fc6a',
          config: {
            pools_id:
              '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
            global_config_id:
              '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
            global_vault_id:
              '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
            admin_cap_id:
              '0x89c1a321291d15ddae5a086c9abc533dff697fde3d89e0ca836c41af73e36a75',
            partners_id:
              '0xac30897fa61ab442f6bff518c5923faa1123c94b36bd4558910e9c783adfa204',
          },
        },
        integrate: {
          package_id:
            '0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3',
          published_at:
            '0x6f5e582ede61fe5395b50c4a449ec11479a54d7ff8e0158247adfda60d98970b',
        },
        deepbook: {
          package_id:
            '0x000000000000000000000000000000000000000000000000000000000000dee9',
          published_at:
            '0x000000000000000000000000000000000000000000000000000000000000dee9',
        },
        deepbook_endpoint_v2: {
          package_id:
            '0x0dd416959739e1db3a4c6f9cac7f9e7202678f3b067d6d419e569a124fc35e0e',
          published_at:
            '0x0dd416959739e1db3a4c6f9cac7f9e7202678f3b067d6d419e569a124fc35e0e',
        },
        aggregatorUrl: 'https://api-sui.cetus.zone/router',
      };

      const sdk = new CetusClmmSDK(mainnet);
      sdk.senderAddress = mainnet.simulationAccount.address;

      const a2b = false;
      // input token amount is token a
      const byAmountIn = true;
      // Fetch pool data
      const pool = await sdk.Pool.getPool(poolAddress, true);

      // build swap Payload
      const swapPayload = await sdk.Swap.createSwapTransactionPayload({
        pool_id: pool.poolAddress,
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        a2b,
        by_amount_in: byAmountIn,
        amount: coinAmount,
        amount_limit: '0',
      });
      console.log({ cetusPayload: swapPayload });
      const tx = await swapPayload.build({ client: provider });

      try {
        const dryTxn = await provider.dryRunTransactionBlock({
          transactionBlock: tx,
        });

        const tokenPriceUSD = new BigNumber(
          // @ts-ignore
          dryTxn.events[0].parsedJson.amount_in,
        )
          .multipliedBy(suiPrice)
          // @ts-ignore
          .dividedBy(dryTxn.events[0].parsedJson.amount_out);

        return {
          payload: swapPayload,
          price: tokenPriceUSD.toFixed(6).toString(),
          // @ts-ignore
          amount: dryTxn.events[0].parsedJson.amount_out,
        };
      } catch (error) {
        console.log('swap cetus error:', error.message);
      }
    } catch (error) {
      console.log('error function swap cetus:', error.message);
      throw new BadRequestException(error);
    }
  }

  async pnlCetus(address: string, poolAddress: string, suiPrice: number) {
    try {
      const SDKConfig = {
        clmmConfig: {
          pools_id:
            '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
          global_config_id:
            '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
          global_vault_id:
            '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
          admin_cap_id:
            '0x89c1a321291d15ddae5a086c9abc533dff697fde3d89e0ca836c41af73e36a75',
        },
        cetusConfig: {
          coin_list_id:
            '0x8cbc11d9e10140db3d230f50b4d30e9b721201c0083615441707ffec1ef77b23',
          launchpad_pools_id:
            '0x1098fac992eab3a0ab7acf15bb654fc1cf29b5a6142c4ef1058e6c408dd15115',
          clmm_pools_id:
            '0x15b6a27dd9ae03eb455aba03b39e29aad74abd3757b8e18c0755651b2ae5b71e',
          admin_cap_id:
            '0x39d78781750e193ce35c45ff32c6c0c3f2941fa3ddaf8595c90c555589ddb113',
          global_config_id:
            '0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f',
          coin_list_handle:
            '0x49136005e90e28c4695419ed4194cc240603f1ea8eb84e62275eaff088a71063',
          launchpad_pools_handle:
            '0x5e194a8efcf653830daf85a85b52e3ae8f65dc39481d54b2382acda25068375c',
          clmm_pools_handle:
            '0x37f60eb2d9d227949b95da8fea810db3c32d1e1fa8ed87434fc51664f87d83cb',
        },
      };
      const mainnet = {
        ...SDKConfig,
        fullRpcUrl: 'https://sui-mainnet-rpc.allthatnode.com',
        swapCountUrl: 'https://api-sui.cetus.zone/v2/sui/swap/count',
        simulationAccount: {
          address,
          // '0x63f65c0d1617925b73e8956edd6f34155c3f3d42a22dd4b39581649e80371471',
        },
        cetus_config: {
          package_id:
            '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
          published_at:
            '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
          config: {
            coin_list_id:
              '0x8cbc11d9e10140db3d230f50b4d30e9b721201c0083615441707ffec1ef77b23',
            launchpad_pools_id:
              '0x1098fac992eab3a0ab7acf15bb654fc1cf29b5a6142c4ef1058e6c408dd15115',
            clmm_pools_id:
              '0x15b6a27dd9ae03eb455aba03b39e29aad74abd3757b8e18c0755651b2ae5b71e',
            admin_cap_id:
              '0x39d78781750e193ce35c45ff32c6c0c3f2941fa3ddaf8595c90c555589ddb113',
            global_config_id:
              '0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f',
            coin_list_handle:
              '0x49136005e90e28c4695419ed4194cc240603f1ea8eb84e62275eaff088a71063',
            launchpad_pools_handle:
              '0x5e194a8efcf653830daf85a85b52e3ae8f65dc39481d54b2382acda25068375c',
            clmm_pools_handle:
              '0x37f60eb2d9d227949b95da8fea810db3c32d1e1fa8ed87434fc51664f87d83cb',
          },
        },
        clmm_pool: {
          package_id:
            '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
          published_at:
            '0xc33c3e937e5aa2009cc0c3fdb3f345a0c3193d4ee663ffc601fe8b894fbc4ba6',
          config: {
            pools_id:
              '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
            global_config_id:
              '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
            global_vault_id:
              '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
            admin_cap_id:
              '0x89c1a321291d15ddae5a086c9abc533dff697fde3d89e0ca836c41af73e36a75',
            partners_id:
              '0xac30897fa61ab442f6bff518c5923faa1123c94b36bd4558910e9c783adfa204',
          },
        },
        integrate: {
          package_id:
            '0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3',
          published_at:
            '0xd43348b8879c1457f882b02555ba862f2bc87bcc31b16294ca14a82f608875d2',
        },
        deepbook: {
          package_id:
            '0x000000000000000000000000000000000000000000000000000000000000dee9',
          published_at:
            '0x000000000000000000000000000000000000000000000000000000000000dee9',
        },
        deepbook_endpoint_v2: {
          package_id:
            '0x0dd416959739e1db3a4c6f9cac7f9e7202678f3b067d6d419e569a124fc35e0e',
          published_at:
            '0x0dd416959739e1db3a4c6f9cac7f9e7202678f3b067d6d419e569a124fc35e0e',
        },
        aggregatorUrl: 'https://api-sui.cetus.zone/router',
      };
      const sdk = new CetusClmmSDK(mainnet);
      sdk.senderAddress = mainnet.simulationAccount.address;

      // Fetch pool data
      const pool = await sdk.Pool.getPool(poolAddress, true);
      const price =
        ((100 * pool.coinAmountB) / (100 + pool.coinAmountA)) * suiPrice;
      const amount = pool.coinAmountA;

      return { price, amount };
    } catch (error) {
      console.log('error get pnl cetus:', error.message);
      return { price: 0, amount: 0 };
    }
  }
}

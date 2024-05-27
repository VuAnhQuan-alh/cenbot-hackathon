import * as Cheerio from 'cheerio';

import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZenRows } from 'zenrows';

@Injectable()
export class CroDataService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  getString() {
    return 'Hello, World!';
  }

  async crawWithZenRows(url: string) {
    const key = this.configService.getOrThrow<string>('ZEN_ROWS_KEY');
    const client = new ZenRows(key);

    try {
      const { data } = await client.get(url, {
        premium_proxy: true,
        js_render: true,
      });

      if (!data) {
        const { data: post } = await client.post(url, {
          premium_proxy: true,
          js_render: true,
        });
        return post;
      }

      return data;
    } catch (error) {
      console.log('error craw with zen rows:', error.message);
      // throw new BadRequestException(error.message);
      const { data: post } = await client.post(url, {
        premium_proxy: true,
        js_render: true,
      });
      return post;
    }
  }

  async asyncFn(fn: () => void, second: number) {
    return new Promise((resolve) =>
      setTimeout(() => resolve(fn()), second * 1000),
    );
  }

  genDexToUri(dex: string) {
    const dexObject = {
      cetus: this.configService.getOrThrow<string>('DEX_CETUS_SWAP'),
      'turbos-finance':
        this.configService.getOrThrow<string>('DEX_TURBOS_FINANCE'),
      flowx: this.configService.getOrThrow<string>('DEX_FLOWX_FINANCE'),
      bluemove: this.configService.getOrThrow<string>('DEX_BLUE_MOVE'),
      flameswap: this.configService.getOrThrow<string>('DEX_FLAME_SWAP'),
    };
    return dexObject[dex];
  }

  async crawPools() {
    try {
      const url = this.configService.getOrThrow<string>('CRO_TOP_POOLS_URL');
      const html = await this.crawWithZenRows(url);

      const nfts = [];
      const $ = Cheerio.load(html);

      $('.ds-dex-table-top .ds-dex-table-row-col-token').each(
        (index, element) => {
          const symbol = $(element)
            .find('.ds-dex-table-row-base-token-symbol')
            .text();
          const quote = $(element)
            .find('.ds-dex-table-row-quote-token-symbol')
            .text();

          const dexUrl = $(element)
            .find('.ds-dex-table-row-dex-icon')
            .attr('src');
          const dexSpit = dexUrl.split('/');
          const dex = dexSpit[dexSpit.length - 1].split('.')[0];

          nfts.push({
            index,
            dex,
            dexUri: this.genDexToUri(dex),
            symbol: `${symbol}/${quote}`,
            price: null,
            '24h': null,
            '6h': null,
            liquidity: null,
            volume: null,
            market: null,
            address: null,
          });
        },
      );

      $('.ds-dex-table-top .ds-dex-table-row.ds-dex-table-row-top').each(
        (index, element) => {
          const attr = $(element).attr('href');
          nfts[index].address = attr.split('/')[2];
        },
      );

      $('.ds-dex-table-top .ds-dex-table-row-col-price').each(
        (index, element) => {
          const price = $(element).text();

          nfts[index].price = price;
        },
      );

      $('.ds-dex-table-top .ds-dex-table-row-col-price-change').each(
        (index, element) => {
          if ((index + 1) % 4 === 0) {
            const change = $(element).text();

            nfts[(index + 1) / 4 - 1]['24h'] = change;
          }

          if ((index + 2) % 4 === 0) {
            const change = $(element).text();

            nfts[(index + 2) / 4 - 1]['6h'] = change;
          }
        },
      );

      $('.ds-dex-table-top .ds-table-data-cell').each((index, element) => {
        if ((index + 2) % 11 === 0) {
          const change = $(element).text();

          nfts[(index + 2) / 11 - 1].liquidity = change;
        }

        if ((index + 8) % 11 === 0) {
          const change = $(element).text();

          nfts[(index + 8) / 11 - 1].volume = change;
        }

        if ((index + 7) % 11 === 0) {
          const change = $(element).text();

          nfts[(index + 7) / 11 - 1].market = change;
        }
      });

      return { message: 'CRO data top pools trade-port.xyz', data: nfts };
    } catch (error) {
      console.error('error fetching pools data:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  async crawGainers() {
    try {
      const url = this.configService.getOrThrow<string>('CRO_TOP_GAINERS_URL');
      const html = await this.crawWithZenRows(url);

      const nfts = [];
      const $ = Cheerio.load(html);

      $('.ds-dex-table-top .ds-dex-table-row-col-token').each(
        (index, element) => {
          const symbol = $(element)
            .find('.ds-dex-table-row-base-token-symbol')
            .text();
          const quote = $(element)
            .find('.ds-dex-table-row-quote-token-symbol')
            .text();

          const dexUrl = $(element)
            .find('.ds-dex-table-row-dex-icon')
            .attr('src');
          const dexSpit = dexUrl.split('/');
          const dex = dexSpit[dexSpit.length - 1].split('.')[0];

          nfts.push({
            index,
            dex,
            dexUri: this.genDexToUri(dex),
            symbol: `${symbol}/${quote}`,
            price: null,
            '24h': null,
            '6h': null,
            liquidity: null,
            volume: null,
            market: null,
            address: null,
          });
        },
      );

      $('.ds-dex-table-top .ds-dex-table-row.ds-dex-table-row-top').each(
        (index, element) => {
          const attr = $(element).attr('href');
          nfts[index].address = attr.split('/')[2];
        },
      );

      $('.ds-dex-table-top .ds-dex-table-row-col-price').each(
        (index, element) => {
          const price = $(element).text();

          nfts[index].price = price;
        },
      );

      $('.ds-dex-table-top .ds-dex-table-row-col-price-change').each(
        (index, element) => {
          if ((index + 1) % 4 === 0) {
            const change = $(element).text();

            nfts[(index + 1) / 4 - 1]['24h'] = change;
          }

          if ((index + 2) % 4 === 0) {
            const change = $(element).text();

            nfts[(index + 2) / 4 - 1]['6h'] = change;
          }
        },
      );

      $('.ds-dex-table-top .ds-table-data-cell').each((index, element) => {
        if ((index + 2) % 11 === 0) {
          const change = $(element).text();

          nfts[(index + 2) / 11 - 1].liquidity = change;
        }

        if ((index + 8) % 11 === 0) {
          const change = $(element).text();

          nfts[(index + 8) / 11 - 1].volume = change;
        }

        if ((index + 7) % 11 === 0) {
          const change = $(element).text();

          nfts[(index + 7) / 11 - 1].market = change;
        }
      });

      return { message: 'CRO data top gainers trade-port.xyz', data: nfts };
    } catch (error) {
      console.error('error fetching gainers data:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  async pairDetail(address: string) {
    try {
      const url = this.configService.getOrThrow('CRO_DETAIL_TOKEN_URL');
      return await this.httpService.axiosRef.get(`${url}/${address}`);
    } catch (error) {
      console.error('error get pair detail:', error.message);
      throw new BadRequestException(error.message);
    }
  }
}

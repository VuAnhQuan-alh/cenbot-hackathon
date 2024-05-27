import BigNumber from 'bignumber.js';
import { provider } from '../configs/provider';
import {
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseQuery,
} from '@mysten/sui.js/client';

interface QueryTransactionsInternalArgs {
  data: Array<SuiTransactionBlockResponse>;
  query: SuiTransactionBlockResponseQuery;
  limit: number;
  cursor: string | null | undefined;
  hasNextPage: boolean;
  startTime: number;
}

interface QueryTransactionsArgs {
  query: SuiTransactionBlockResponseQuery;
  limit: number;
  startTime: number;
}

const queryTransactionsInternal = async ({
  data,
  query,
  limit,
  cursor,
  hasNextPage,
  startTime,
}: QueryTransactionsInternalArgs): Promise<
  Array<SuiTransactionBlockResponse>
> => {
  if (!hasNextPage) return data;

  const payload = await provider.queryTransactionBlocks({
    ...query,
    cursor,
  });

  const isContinue = new BigNumber(
    payload.data[payload.data.length - 1].timestampMs,
  ).gt(startTime)
    ? payload.hasNextPage
      ? data.length + payload.data.length < limit
      : false
    : false;

  return queryTransactionsInternal({
    query,
    limit,
    cursor: payload.nextCursor,
    hasNextPage: isContinue,
    data: data.concat(payload.data),
    startTime,
  });
};

export const queryTransactions = async ({
  query,
  limit,
  startTime,
}: QueryTransactionsArgs): Promise<Array<SuiTransactionBlockResponse>> => {
  const payload = await provider.queryTransactionBlocks(query);
  const hasNextPage = new BigNumber(
    payload.data[payload.data.length - 1].timestampMs,
  ).gt(startTime)
    ? payload.hasNextPage
      ? payload.data.length < limit
      : false
    : false;

  const transactions = await queryTransactionsInternal({
    query,
    limit,
    cursor: payload.nextCursor,
    data: payload.data,
    hasNextPage,
    startTime,
  });

  const uniqueTransactions: Array<SuiTransactionBlockResponse> = [];
  transactions.forEach((e) => {
    if (
      new BigNumber(e.timestampMs).gt(startTime) &&
      !uniqueTransactions.find((ue) => ue.digest === e.digest)
    ) {
      uniqueTransactions.push(e);
    }
  });

  return uniqueTransactions;
};

type Data = {
  balance: string;
  coinObjectId: string;
  coinType: string;
  digest: string;
  previousTransaction: string;
  version: string;
}[];

export default function selectCoinSetWithCombinedBalanceGreaterThanOrEqual(
  arr: Data,
  amount: number,
) {
  const n = arr.length;
  let start = 0,
    end = 0,
    sum = 0;
  let min_length = n + 1,
    min_start = 0;

  while (end < n) {
    sum += parseInt(arr[end++].balance);
    while (sum >= amount) {
      if (end - start < min_length) {
        min_length = end - start;
        min_start = start;
      }
      sum -= parseInt(arr[start++].balance);
    }
  }

  return min_length <= n ? arr.slice(min_start, min_start + min_length) : [];
}

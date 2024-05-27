export type SwapEvent = {
  name: string;
  type: string;
  amount_in: string;
  amount_out: string;
  coin_in: string;
  coin_out: string;
  pool: string;
  sender: string;
  hash: string;
  timestampMs: string;
};

export type LiquidityEvent = {
  name: string;
  type: string;
  coin_x: string;
  coin_y: string;
  amount_x: string;
  amount_y: string;
  pool: string;
  sender: string;
  hash: string;
  timestampMs: string;
};

export type ParsedSuiEvent = {
  parsedJson: {
    amount_x_in: string;
    amount_y_in: string;
    amount_x_out: string;
    amount_y_out: string;
    coin_x: string;
    coin_y: string;

    amount_x: string;
    amount_y: string;
    amount_in: string;
    amount_out: string;
    pool: string;
    atob: boolean;

    amount_a: string;
    amount_b: string;
    a_to_b: boolean;
  };
};

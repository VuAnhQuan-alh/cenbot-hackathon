export enum TransactionStatus {
  QUEUED = 'queued',
  PENDING = 'pending',
  SUCCEED = 'succeed',
  ERROR = 'error',
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  TRANSFER = 'transfer',
  SWAP = 'swap',
  BUY = 'buy',
  SELL = 'sell',
  BET = 'bet',
  GIVE = 'give',
  RECEIVE = 'receive',
  WINNING_PRIZE = 'winning_prize',
  WINNING_JACKPOT = 'winning_jackpot',
  OWNER_ALLOWANCE = 'owner_allowance',
  LEADER_ALLOWANCE = 'leader_allowance',
  BET_REFERRAL_COMMISSION = 'bet_referral_commission',
  GIVE_REFERRAL_COMMISSION = 'give_referral_commission',
  FEE_COMMISSION = 'fee_commission',
  WITHDRAW_FEE_COMMISSION = 'withdraw_fee_commission',
  GIVE_ALLOWANCE = 'give_allowance',
  STAKE = 'stake',
  STAKE_EARNING = 'stake_earning',
  STAKE_REFERRAL_COMMISSION = 'stake_referral_commission',
}

export enum TypeDailyTasks {
  TRANSFER = 'TRANSFER',
  SWAP = 'SWAP',
}

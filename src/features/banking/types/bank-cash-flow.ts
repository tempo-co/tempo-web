export const BANK_CASH_FLOW_GRANULARITIES = ['week', 'month', 'year'] as const;
export type BankCashFlowGranularity = (typeof BANK_CASH_FLOW_GRANULARITIES)[number];

export type BankCashFlowBucket = {
  startDate: string;
  endDate: string;
  income: string;
  expenses: string;
  net: string;
  transactionCount: number;
  includedTransactionCount: number;
  internalCount: number;
  unknownCount: number;
};

export type BankCashFlowTotals = Omit<BankCashFlowBucket, 'startDate' | 'endDate'>;

export type BankCashFlowSeries = {
  currency: string;
  buckets: BankCashFlowBucket[];
  totals: BankCashFlowTotals;
};

export type BankCashFlowResponse = {
  granularity: Uppercase<BankCashFlowGranularity>;
  from: string;
  to: string;
  series: BankCashFlowSeries[];
  dataQuality: {
    missingBookingDateCount: number;
  };
};

export const RECURRING_CADENCES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export type RecurringSeriesDirection = 'EXPENSE' | 'INCOME';

/** The earlier history a series continues: joined with it, or kept apart because the owner unlinked them. */
export type RecurringContinuation = {
  previousName: string;
  previousFirstDate: string;
  previousLastDate: string;
  linked: boolean;
};

/** A fixed price's recent change: `amount` is signed, `since` is the first payment at the new price. */
export type RecurringPriceChange = {
  amount: string;
  since: string;
};

/** A detected series of payments. Amounts are positive two-decimal strings. */
export type RecurringSeries = {
  key: string;
  name: string;
  direction: RecurringSeriesDirection;
  cadence: RecurringCadence;
  amountKind: 'FIXED' | 'VARIABLE';
  currency: string;
  /** The latest payment, or the one before it while the latest is a one-off. */
  typicalAmount: string;
  latestAmount: string;
  /** In the owner's base currency; null until every payment has a converted amount. */
  monthlyEquivalent: string | null;
  transactionCount: number;
  firstDate: string;
  lastDate: string;
  nextExpectedDate: string;
  status: 'ACTIVE' | 'ENDED';
  flags: Array<'LATE'>;
  priceChange: RecurringPriceChange | null;
  /** Marked as not recurring by the owner; left out of totals. */
  hidden: boolean;
  continuation: RecurringContinuation | null;
};

export type RecurringSeriesList = {
  series: RecurringSeries[];
  monthlyTotal: string;
  unconvertedCount: number;
  baseCurrency: string | null;
};

/** Bills and income, from one read. */
export type RecurringSeriesLists = {
  expenses: RecurringSeriesList;
  income: RecurringSeriesList;
};

export type RecurringUpcomingPayment = Pick<
  RecurringSeries,
  'key' | 'name' | 'direction' | 'nextExpectedDate' | 'typicalAmount' | 'currency'
>;

export type RecurringSummary = {
  expenseMonthlyTotal: string;
  incomeMonthlyTotal: string;
  upcoming: RecurringUpcomingPayment[];
  expenseUnconvertedCount: number;
  incomeUnconvertedCount: number;
  baseCurrency: string | null;
};

export const RECURRING_CADENCE_LABELS: Record<RecurringCadence, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

export const RECURRING_CADENCES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export type RecurringSeriesDirection = 'EXPENSE' | 'INCOME';
export type RecurringSeriesDecision = 'CONFIRMED' | 'DISMISSED';
export type RecurringContinuationChoice = 'LINKED' | 'SEPARATE';

/** An earlier history this series may continue; `choice` is null until the owner answers. */
export type RecurringContinuation = {
  choice: RecurringContinuationChoice | null;
  previousName: string;
  previousFirstDate: string;
  previousLastDate: string;
};

/** A detected series of payments. Amounts are positive two-decimal strings. */
export type RecurringSeries = {
  key: string;
  name: string;
  direction: RecurringSeriesDirection;
  cadence: RecurringCadence;
  amountKind: 'FIXED' | 'VARIABLE';
  currency: string;
  typicalAmount: string;
  latestAmount: string;
  /** In the owner's base currency; null until every payment has a converted amount. */
  monthlyEquivalent: string | null;
  transactionCount: number;
  firstDate: string;
  lastDate: string;
  nextExpectedDate: string;
  status: 'ACTIVE' | 'ENDED';
  flags: Array<'PRICE_INCREASED' | 'LATE'>;
  decision: RecurringSeriesDecision | null;
  continuation: RecurringContinuation | null;
};

export type RecurringSeriesList = {
  series: RecurringSeries[];
  confirmedMonthlyTotal: string;
  unconvertedConfirmedCount: number;
  baseCurrency: string | null;
};

export const RECURRING_CADENCE_LABELS: Record<RecurringCadence, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

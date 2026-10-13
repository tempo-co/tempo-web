/** One month of spending and income in the owner's base currency, as two-decimal strings. */
export type CashFlowMonth = {month: string; spending: string; income: string; net: string};

/**
 * Monthly totals from `from` to `to`, oldest first, using the Home summary's definitions. Months
 * before the first synced transaction are omitted; the month containing `through` is cut there.
 */
export type BankTransactionCashFlow = {
  baseCurrency: string | null;
  through: string;
  months: CashFlowMonth[];
};

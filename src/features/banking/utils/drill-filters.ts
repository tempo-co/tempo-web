import type {BankTransactionFilterParams} from '../types/bank-transaction';

/** True when the list carries a filter only the Home dashboard sets. */
export function hasDrillFilters(filters: BankTransactionFilterParams) {
  return (
    (filters.cashFlows?.length ?? 0) > 0 ||
    Boolean(filters.baseAmount) ||
    (filters.categoryStatuses?.length ?? 0) > 0
  );
}

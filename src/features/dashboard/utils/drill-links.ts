import {parse} from 'date-fns';

import type {
  BankTransactionCategoryFilterValue,
  BankTransactionSearchParams,
} from '@/features/banking/types/bank-transaction';

/** Search params for a `/bank-transactions/` link; the list fills in pagination defaults. */
export type BankTransactionDrillSearch = Partial<BankTransactionSearchParams>;

/** A local-midnight date for a `YYYY-MM-DD` string, matching what the date filter produces. */
export function parseCalendarDate(value: string) {
  return parse(value, 'yyyy-MM-dd', new Date());
}

function bookingRange(from: string, to: string) {
  return {from: parseCalendarDate(from), to: parseCalendarDate(to)};
}

/** Rows counted in a spending total between two calendar dates. */
export function spendingDrill(from: string, to: string): BankTransactionDrillSearch {
  return {bookingDate: bookingRange(from, to), cashFlows: ['SPENDING'], baseAmount: 'PRESENT'};
}

/** Rows counted in an income total between two calendar dates. */
export function incomeDrill(from: string, to: string): BankTransactionDrillSearch {
  return {bookingDate: bookingRange(from, to), cashFlows: ['INCOME'], baseAmount: 'PRESENT'};
}

/** Rows counted in one category's spending between two calendar dates. */
export function categoryDrill(
  category: BankTransactionCategoryFilterValue,
  from: string,
  to: string,
): BankTransactionDrillSearch {
  return {...spendingDrill(from, to), categories: [category]};
}

/** Rows a period leaves out of its totals, matching the summary's `excluded` counts. */
export const excludedDrills = {
  unknownDirection: (from: string, to: string): BankTransactionDrillSearch => ({
    bookingDate: bookingRange(from, to),
    cashFlows: ['UNKNOWN'],
  }),
  missingBaseAmount: (from: string, to: string): BankTransactionDrillSearch => ({
    bookingDate: bookingRange(from, to),
    cashFlows: ['SPENDING', 'INCOME', 'UNKNOWN'],
    baseAmount: 'MISSING',
  }),
};

/** All-time rows behind each review count; the keys match the review counts response. */
export const reviewDrills = {
  needsReview: {categories: ['NEEDS_REVIEW']},
  categorizationFailed: {categoryStatuses: ['FAILED']},
  categorizing: {categoryStatuses: ['CATEGORIZING']},
  unknownDirection: {cashFlows: ['UNKNOWN']},
  // Internal rows are left out of the count, so they are left out of the list too.
  missingBaseAmount: {cashFlows: ['SPENDING', 'INCOME', 'UNKNOWN'], baseAmount: 'MISSING'},
} as const satisfies Record<string, BankTransactionDrillSearch>;

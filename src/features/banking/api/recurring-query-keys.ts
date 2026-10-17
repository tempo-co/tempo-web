import type {RecurringSeriesDirection} from '../types/recurring-series';

export const recurringQueryKeys = {
  root: ['recurring-series'] as const,
  list: (direction: RecurringSeriesDirection, asOf: string) =>
    ['recurring-series', direction, asOf] as const,
};

import {useQuery} from '@tanstack/react-query';

import {api} from '@/utils/api';

import type {RecurringSummary} from '../types/recurring-series';
import {recurringQueryKeys} from './recurring-query-keys';

/** Recurring bills and income totals with the next payments due, judged at `asOf`. */
export const useGetRecurringSummary = (asOf: string) => {
  const {data, isPending, isError, refetch} = useQuery<RecurringSummary>({
    queryKey: recurringQueryKeys.summary(asOf),
    queryFn: () =>
      api.get<RecurringSummary>(`/recurring-series/summary?${new URLSearchParams({asOf})}`),
    // Data restored or kept while offline may be outdated, however recently it was fetched.
    refetchOnReconnect: 'always',
  });
  return {summary: data, isPending, isError, refetch};
};

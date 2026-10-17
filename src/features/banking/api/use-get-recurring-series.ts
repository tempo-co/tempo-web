import {useQuery} from '@tanstack/react-query';

import {api} from '@/utils/api';

import type {RecurringSeriesDirection, RecurringSeriesList} from '../types/recurring-series';
import {recurringQueryKeys} from './recurring-query-keys';

/** Recurring payments detected in the owner's history; late and ended are judged at `asOf`. */
export const useGetRecurringSeries = (
  direction: RecurringSeriesDirection,
  asOf: string,
  {enabled = true}: {enabled?: boolean} = {},
) => {
  const {data, isPending, isError, error, fetchStatus, refetch} = useQuery<RecurringSeriesList>({
    queryKey: recurringQueryKeys.list(direction, asOf),
    queryFn: () => {
      const params = new URLSearchParams({direction, asOf});
      return api.get<RecurringSeriesList>(`/recurring-series?${params.toString()}`);
    },
    enabled,
    // Data restored or kept while offline may be outdated, however recently it was fetched.
    refetchOnReconnect: 'always',
  });

  return {data, isPending, isError, error, fetchStatus, refetch};
};

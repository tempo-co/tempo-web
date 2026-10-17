import {useMutation, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';

import {HttpError, api} from '@/utils/api';

import type {RecurringSeriesDecision} from '../types/recurring-series';
import {recurringQueryKeys} from './recurring-query-keys';

type Input = {
  key: string;
  /** `null` returns the series to suggested. */
  decision: RecurringSeriesDecision | null;
};

const SUCCESS: Record<RecurringSeriesDecision | 'NONE', string> = {
  CONFIRMED: 'Confirmed as recurring.',
  DISMISSED: 'Dismissed. It stays out of your recurring payments.',
  NONE: 'Back to suggested.',
};

/** Confirms, dismisses or resets one series. It never changes the transactions themselves. */
export const useUpdateRecurringSeriesDecision = () => {
  const queryClient = useQueryClient();
  const {mutateAsync, isPending, variables} = useMutation<void, HttpError, Input>({
    mutationFn: async ({key, decision}) => {
      await api.patch<void>(`/recurring-series/${key}/decision`, JSON.stringify({decision}));
    },
    onSuccess: () => queryClient.invalidateQueries({queryKey: recurringQueryKeys.root}),
  });

  const updateDecision = (input: Input) =>
    toast.promise(mutateAsync(input), {
      loading: 'Saving...',
      success: SUCCESS[input.decision ?? 'NONE'],
      error: 'Could not save. Please try again.',
    });

  return {updateDecision, isPending, pendingKey: isPending ? variables?.key : undefined};
};

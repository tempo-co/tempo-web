import {useMutation, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';

import {HttpError, api, isAuthError} from '@/utils/api';

import type {RecurringContinuationChoice} from '../types/recurring-series';
import {recurringQueryKeys} from './recurring-query-keys';

type Input = {
  key: string;
  /** `null` removes the answer: a linked history splits again, a separated one is asked again. */
  choice: RecurringContinuationChoice | null;
};

/**
 * Answers whether a series continues an earlier history. The row shows progress and the result,
 * so only failures toast. It never changes the transactions themselves.
 */
export const useUpdateRecurringContinuation = () => {
  const queryClient = useQueryClient();
  const {mutateAsync, isPending, variables} = useMutation<void, HttpError, Input>({
    mutationFn: async ({key, choice}) => {
      await api.patch<void>(`/recurring-series/${key}/continuation`, JSON.stringify({choice}));
    },
    onSuccess: () => queryClient.invalidateQueries({queryKey: recurringQueryKeys.root}),
  });

  const updateContinuation = async (input: Input) => {
    try {
      await mutateAsync(input);
    } catch (error) {
      // An expired session or unverified email has its own toast and redirect.
      if (!isAuthError(error)) toast.error('Could not save. Please try again.');
    }
  };

  return {updateContinuation, pendingKey: isPending ? variables?.key : undefined};
};

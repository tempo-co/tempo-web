import {useMutation, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';

import {HttpError, api, isAuthError} from '@/utils/api';

import {recurringQueryKeys} from './recurring-query-keys';

type Change =
  | {kind: 'hidden'; key: string; hidden: boolean}
  | {kind: 'linked'; key: string; linked: boolean; previousName: string};

const path = (change: Change) =>
  change.kind === 'hidden'
    ? [`/recurring-series/${change.key}/hidden`, {hidden: change.hidden}]
    : [`/recurring-series/${change.key}/continuation`, {linked: change.linked}];

const inverse = (change: Change): Change =>
  change.kind === 'hidden'
    ? {...change, hidden: !change.hidden}
    : {...change, linked: !change.linked};

function message(change: Change) {
  if (change.kind === 'hidden')
    return change.hidden ? 'Hidden from recurring payments.' : 'Counted as recurring again.';
  return change.linked
    ? `Linked with ${change.previousName} again.`
    : `Unlinked from ${change.previousName}.`;
}

/**
 * Hides a series or unlinks a joined history, and the reverse. Every change offers an undo, so a
 * wrong automatic result is one tap away from fixed. It never changes the transactions themselves.
 */
export const useUpdateRecurringSeries = () => {
  const queryClient = useQueryClient();
  const {mutateAsync, isPending, variables} = useMutation<void, HttpError, Change>({
    mutationFn: async (change) => {
      const [url, body] = path(change);
      await api.patch<void>(url as string, JSON.stringify(body));
    },
    onSuccess: () => queryClient.invalidateQueries({queryKey: recurringQueryKeys.root}),
  });

  const save = async (change: Change, undoable: boolean) => {
    try {
      await mutateAsync(change);
    } catch (error) {
      // An expired session or unverified email has its own toast and redirect.
      if (!isAuthError(error)) toast.error('Could not save. Please try again.');
      return;
    }
    toast.success(
      message(change),
      undoable ? {action: {label: 'Undo', onClick: () => void save(inverse(change), false)}} : {},
    );
  };

  return {
    update: (change: Change) => save(change, true),
    pendingKey: isPending ? variables?.key : undefined,
  };
};

import {useQuery, useQueryClient} from '@tanstack/react-query';

import {BankConnection} from '@/features/banking/types/bank-connection';
import {api} from '@/utils/api';

import {dashboardQueryKeys} from './aggregate-query-keys';
import {bankQueryKeys} from './query-keys';

const AUTOMATIC_SYNC_POLL_INTERVAL_MS = 5_000;

export const useGetAllBankConnections = () => {
  const queryClient = useQueryClient();
  const {
    data: bankConnections,
    isPending,
    isError,
    refetch,
  } = useQuery<BankConnection[]>({
    queryKey: bankQueryKeys.connections,
    queryFn: async () => {
      const connections = await api.get<BankConnection[]>('/bank-connections');
      const previous = queryClient.getQueryData<BankConnection[]>(bankQueryKeys.connections);
      const syncAdvanced = connections.some((connection) => {
        const before = previous?.find(({id}) => id === connection.id);
        if (!before) return false;
        const wasSyncing = before.syncStatus === 'QUEUED' || before.syncStatus === 'RUNNING';
        return (
          (wasSyncing && before.syncStatus !== connection.syncStatus) ||
          (connection.lastSyncedAt !== null &&
            (before.lastSyncedAt === null ||
              Date.parse(connection.lastSyncedAt) > Date.parse(before.lastSyncedAt)))
        );
      });
      if (syncAdvanced) {
        // Use cache roots so inactive months and filtered transaction lists are stale too.
        // Sync completion only covers ingestion; the API exposes no derived-work revision.
        await Promise.all([
          queryClient.invalidateQueries({queryKey: dashboardQueryKeys.root}),
          queryClient.invalidateQueries({queryKey: bankQueryKeys.transactionsRoot}),
          queryClient.invalidateQueries({queryKey: bankQueryKeys.transactionRoot}),
          queryClient.invalidateQueries({queryKey: bankQueryKeys.connectionTransactionsRoot}),
        ]);
      }
      return connections;
    },
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.some(
        (connection) => connection.syncStatus === 'QUEUED' || connection.syncStatus === 'RUNNING',
      )
        ? AUTOMATIC_SYNC_POLL_INTERVAL_MS
        : false,
  });

  return {bankConnections, isPending, isError, refetch};
};

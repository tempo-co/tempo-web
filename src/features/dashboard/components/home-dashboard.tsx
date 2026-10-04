import {Link} from '@tanstack/react-router';
import {RefreshCw} from 'lucide-react';

import {EmptyState} from '@/components/shared/layout/app-empty-state';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {useGetAllBankConnections} from '@/features/banking/api/use-get-all-bank-connections';

import {isConnectedBank} from '../utils/sync-status';
import {HomeSyncStatus} from './home-sync-status';
import {MonthNavigation} from './month-navigation';

type HomeDashboardProps = {
  month: string;
  isCurrentMonth: boolean;
};

export function HomeDashboard({month, isCurrentMonth}: HomeDashboardProps) {
  const {bankConnections, isPending, isError, refetch} = useGetAllBankConnections();

  if (isPending) return <HomeDashboardSkeleton />;

  if (isError) {
    return (
      <EmptyState
        icon={RefreshCw}
        title='Could not load your banks'
        description='The connection service did not respond. Try again in a moment.'
      >
        <Button variant='outline' onClick={() => void refetch()}>
          Try again
        </Button>
      </EmptyState>
    );
  }

  const connections = (bankConnections ?? []).filter(isConnectedBank);
  if (connections.length === 0) return <ConnectBankPrompt />;

  return (
    <div className='flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5'>
      <MonthNavigation month={month} isCurrentMonth={isCurrentMonth} />
      <HomeSyncStatus connections={connections} />
    </div>
  );
}

function HomeDashboardSkeleton() {
  return (
    <div aria-busy='true' aria-label='Loading your month' className='grid gap-5'>
      <div className='flex flex-wrap items-center justify-between gap-2.5'>
        <Skeleton className='h-8 w-44' />
        <Skeleton className='h-4 w-64' />
      </div>
      <Card className='grid gap-3 p-5'>
        <Skeleton className='h-8 w-2/5' />
        <Skeleton className='h-4 w-1/2' />
        <Skeleton className='h-52' />
      </Card>
    </div>
  );
}

function ConnectBankPrompt() {
  return (
    <Card className='flex flex-col items-center gap-2.5 px-6 py-18 text-center'>
      <h2 className='text-lg font-semibold'>Connect a bank to see your month</h2>
      <p className='max-w-md text-sm text-muted-foreground'>
        Home summarizes spending, balances and anything that needs a look once Tempo has synced at
        least one account.
      </p>
      <Button asChild className='mt-2'>
        <Link to='/bank-connections'>Connect bank</Link>
      </Button>
    </Card>
  );
}

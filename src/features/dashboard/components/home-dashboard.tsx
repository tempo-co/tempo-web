import {Link} from '@tanstack/react-router';
import {RefreshCw} from 'lucide-react';

import {EmptyState} from '@/components/shared/layout/app-empty-state';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {useGetAllBankConnections} from '@/features/banking/api/use-get-all-bank-connections';

import {useGetBankTransactionReviewCounts} from '../api/use-get-bank-transaction-review-counts';
import {useGetBankTransactionSummary} from '../api/use-get-bank-transaction-summary';
import {localDate} from '../utils/month';
import {isConnectedBank} from '../utils/sync-status';
import {AttentionList} from './attention-list';
import {BalancesList} from './balances-list';
import {CategoryBreakdown} from './category-breakdown';
import {HomeSyncStatus} from './home-sync-status';
import {MonthNavigation} from './month-navigation';
import {RecentTransactions} from './recent-transactions';
import {SpendingSummaryCard} from './spending-summary-card';

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
    <div className='@container'>
      <div className='flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5'>
        <MonthNavigation month={month} isCurrentMonth={isCurrentMonth} />
        <HomeSyncStatus connections={connections} />
      </div>
      <div className='mt-5 grid gap-5 @[900px]:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]'>
        <MonthlySpending month={month} isCurrentMonth={isCurrentMonth} />
        <div className='grid min-w-0 content-start gap-5'>
          <HomeAttention baseCurrency={connections[0]?.baseCurrency ?? null} />
          <BalancesList connections={connections} isCurrentMonth={isCurrentMonth} />
          <RecentTransactions month={month} isCurrentMonth={isCurrentMonth} />
        </div>
      </div>
    </div>
  );
}

function MonthlySpending({month, isCurrentMonth}: HomeDashboardProps) {
  const {summary, isPending, isError, refetch} = useGetBankTransactionSummary(month, localDate());
  if (isPending) return <Skeleton className='h-96' aria-label='Loading spending' />;
  if (isError || !summary)
    return (
      <Card className='p-5'>
        <p>Could not load spending.</p>
        <Button variant='outline' onClick={() => void refetch()}>
          Try again
        </Button>
      </Card>
    );
  return (
    <div className='grid min-w-0 content-start gap-5'>
      <SpendingSummaryCard summary={summary} isCurrentMonth={isCurrentMonth} />
      <CategoryBreakdown summary={summary} isCurrentMonth={isCurrentMonth} />
    </div>
  );
}

function HomeAttention({baseCurrency}: {baseCurrency: string | null}) {
  const {reviewCounts, isPending, isError, refetch} = useGetBankTransactionReviewCounts();
  if (isPending) return <Skeleton className='h-40' aria-label='Loading attention counts' />;
  if (isError || !reviewCounts)
    return (
      <Card className='p-5'>
        <p>Could not load attention counts.</p>
        <Button variant='outline' onClick={() => void refetch()}>
          Try again
        </Button>
      </Card>
    );
  return <AttentionList reviewCounts={reviewCounts} baseCurrency={baseCurrency} />;
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

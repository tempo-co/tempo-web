import {Link} from '@tanstack/react-router';

import {CurrencyAmount} from '@/components/shared/currency-amount';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {useGetBankTransactions} from '@/features/banking/api/use-get-bank-transactions';
import {
  formatBankTransactionCategorySubtitle,
  formatBankTransactionCompactDate,
  resolveBankTransactionDisplayTitle,
} from '@/features/banking/utils/formatters';

import {HOME_REFRESH_INTERVAL_MS} from '../api/refresh-interval';
import {parseCalendarDate} from '../utils/drill-links';
import {formatMonth, monthDates} from '../utils/month';

export function RecentTransactions({
  month,
  isCurrentMonth,
}: {
  month: string;
  isCurrentMonth: boolean;
}) {
  const dates = monthDates(month);
  const bookingDate = {from: parseCalendarDate(dates.from), to: parseCalendarDate(dates.to)};
  const {data, isPending, isPlaceholderData, isError, refetch} = useGetBankTransactions(
    {pageIndex: 0, pageSize: 10, bookingDate},
    {refetchInterval: HOME_REFRESH_INTERVAL_MS},
  );
  const title = isCurrentMonth ? 'Recent' : `Latest in ${formatMonth(month)}`;
  return (
    <Card role='region' aria-label={title} className='p-5'>
      <header className='mb-3 flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='text-base font-semibold'>{title}</h2>
        <Link
          to='/bank-transactions'
          search={{bookingDate}}
          className='text-xs text-primary hover:underline'
        >
          View all
        </Link>
      </header>
      {isPending || isPlaceholderData ? (
        <Skeleton className='h-32' />
      ) : isError ? (
        <>
          <p className='text-sm'>Could not load transactions.</p>
          <Button variant='outline' onClick={() => void refetch()}>
            Try again
          </Button>
        </>
      ) : !data?.transactions.length ? (
        <p className='text-sm text-muted-foreground'>No transactions this month.</p>
      ) : (
        <ul className='divide-y divide-border/60'>
          {data.transactions.map((transaction) => (
            <li key={transaction.id}>
              <Link
                to='/bank-transactions'
                search={{bookingDate, transactionId: transaction.id}}
                className='grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 hover:bg-accent/50'
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm'>
                    {resolveBankTransactionDisplayTitle(transaction)}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {formatBankTransactionCompactDate(transaction.bookingDate)} ·{' '}
                    {formatBankTransactionCategorySubtitle(transaction)}
                  </p>
                </div>
                <span className='text-sm'>
                  <CurrencyAmount
                    amount={Number(transaction.amount)}
                    currency={transaction.currency}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

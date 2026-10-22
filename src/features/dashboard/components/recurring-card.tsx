import {Link} from '@tanstack/react-router';
import {ChevronRight} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {useGetRecurringSummary} from '@/features/banking/api/use-get-recurring-summary';
import {formatBankTransactionCompactDate} from '@/features/banking/utils/formatters';
import {useLocalDate} from '@/hooks/use-local-date';

import {formatMoney} from '../utils/money';

/** Recurring bills and income a month, and what is due next; the full list is one tap away. */
export function RecurringCard() {
  const asOf = useLocalDate();
  const {summary, isPending, isError, refetch} = useGetRecurringSummary(asOf);

  if (isPending) return <Skeleton className='h-48' aria-label='Loading recurring payments' />;

  return (
    <Card className='grid gap-4 p-5 sm:p-6' role='region' aria-label='Recurring payments'>
      <header className='flex items-baseline justify-between gap-3'>
        <h2 className='text-section-title'>Recurring</h2>
        <Link
          to='/recurring'
          className='-my-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
          aria-label='See all recurring payments'
        >
          See all <ChevronRight className='size-4' aria-hidden />
        </Link>
      </header>
      {isError || !summary ? (
        <div className='grid justify-items-start gap-3'>
          <p className='text-sm'>Could not load recurring payments.</p>
          <Button variant='outline' onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : summary.upcoming.length === 0 && Number(summary.expenseMonthlyTotal) === 0 ? (
        <p className='text-sm text-muted-foreground'>No recurring payments found yet.</p>
      ) : (
        <>
          <div className='grid gap-1'>
            <p className='text-sm text-muted-foreground'>
              <span className='numeric text-xl font-semibold text-foreground'>
                {formatMoney(summary.expenseMonthlyTotal, summary.baseCurrency)}
              </span>{' '}
              a month in bills
            </p>
            {Number(summary.incomeMonthlyTotal) > 0 && (
              <p className='text-sm text-muted-foreground'>
                <span className='numeric font-medium text-foreground'>
                  {formatMoney(summary.incomeMonthlyTotal, summary.baseCurrency)}
                </span>{' '}
                a month in income
              </p>
            )}
          </div>
          {summary.upcoming.length > 0 && (
            <div className='grid gap-2'>
              <h3 className='text-xs font-medium text-muted-foreground'>Next up</h3>
              <ul className='grid gap-2'>
                {summary.upcoming.map((payment) => (
                  <li key={payment.key} className='flex items-baseline gap-3 text-sm'>
                    <span className='w-14 shrink-0 text-muted-foreground'>
                      {formatBankTransactionCompactDate(payment.nextExpectedDate)}
                    </span>
                    <span className='min-w-0 flex-1 truncate'>{payment.name}</span>
                    <span className='shrink-0 numeric'>
                      {payment.direction === 'INCOME' && '+'}
                      {formatMoney(payment.typicalAmount, payment.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

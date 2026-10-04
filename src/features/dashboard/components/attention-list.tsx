import {Link} from '@tanstack/react-router';
import {ArrowUpRight} from 'lucide-react';
import {useId} from 'react';

import {Card} from '@/components/ui/card';

import type {BankTransactionReviewCounts} from '../types/bank-transaction-summary';
import {reviewDrills} from '../utils/drill-links';

type AttentionListProps = {
  reviewCounts: BankTransactionReviewCounts;
  baseCurrency: string | null;
};

/** All-time review groups can overlap, so their counts must not be added together. */
export function AttentionList({reviewCounts, baseCurrency}: AttentionListProps) {
  const headingId = useId();
  const groups: {key: keyof BankTransactionReviewCounts; label: string}[] = [
    {key: 'needsReview', label: 'Needs review'},
    {key: 'categorizationFailed', label: 'Not categorized'},
    {key: 'categorizing', label: 'Categorizing'},
    {key: 'unknownDirection', label: 'Unknown direction'},
    {key: 'missingBaseAmount', label: `No ${baseCurrency ?? 'base-currency'} amount yet`},
  ];
  const visibleGroups = groups.filter(({key}) => reviewCounts[key] > 0);

  return (
    <Card role='region' aria-labelledby={headingId} className='gap-4 p-5'>
      <h2 id={headingId} className='text-base font-semibold'>
        Needs attention
      </h2>
      {visibleGroups.length === 0 ? (
        <p className='text-sm text-muted-foreground'>Everything is categorized and counted.</p>
      ) : (
        <>
          <ul className='divide-y divide-border'>
            {visibleGroups.map(({key, label}) => (
              <li key={key}>
                <Link
                  to='/bank-transactions'
                  search={reviewDrills[key]}
                  className='group flex min-h-14 items-center justify-between gap-3 rounded-sm py-3 outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring'
                >
                  <span className='min-w-0'>
                    <span className='block text-sm font-medium group-hover:underline'>{label}</span>
                    <span className='block text-xs text-muted-foreground'>
                      {reviewCounts[key]} {reviewCounts[key] === 1 ? 'transaction' : 'transactions'}{' '}
                      · all months
                    </span>
                  </span>
                  <ArrowUpRight
                    aria-hidden='true'
                    className='size-4 shrink-0 text-muted-foreground'
                  />
                </Link>
              </li>
            ))}
          </ul>
          <p className='text-xs text-muted-foreground'>
            A transaction can appear in more than one group.
          </p>
        </>
      )}
    </Card>
  );
}

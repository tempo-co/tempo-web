import {Link} from '@tanstack/react-router';
import {RefreshCw, Repeat} from 'lucide-react';
import {useState} from 'react';

import {EmptyState} from '@/components/shared/layout/app-empty-state';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {formatMoney} from '@/features/dashboard/utils/money';
import {savedDataStatus} from '@/utils/query-status';

import {useGetRecurringSeries} from '../api/use-get-recurring-series';
import {useUpdateRecurringSeriesDecision} from '../api/use-update-recurring-series-decision';
import {RECURRING_CADENCE_LABELS, type RecurringSeries} from '../types/recurring-series';
import {formatBankTransactionCompactDate} from '../utils/formatters';

type Groups = Record<'confirmed' | 'suggested' | 'ended' | 'dismissed', RecurringSeries[]>;

function groupSeries(series: RecurringSeries[]): Groups {
  const groups: Groups = {confirmed: [], suggested: [], ended: [], dismissed: []};
  for (const entry of series) {
    if (entry.decision === 'DISMISSED') groups.dismissed.push(entry);
    else if (entry.status === 'ENDED') groups.ended.push(entry);
    else if (entry.decision === 'CONFIRMED') groups.confirmed.push(entry);
    else groups.suggested.push(entry);
  }
  return groups;
}

/** Recurring payments: confirmed ones with their monthly cost, suggestions to confirm or dismiss. */
export function RecurringSeriesOverview({asOf}: {asOf: string}) {
  const query = useGetRecurringSeries('EXPENSE', asOf);
  const {isPending, isError} = savedDataStatus(query);
  const {data} = query;

  if (isPending) return <RecurringSkeleton />;
  if (isError || !data) {
    return (
      <EmptyState
        icon={RefreshCw}
        tone='error'
        title='Recurring payments are unavailable right now'
        description='Your transactions are unchanged. Try again in a moment.'
      >
        <Button variant='outline' onClick={() => void query.refetch()}>
          Try again
        </Button>
      </EmptyState>
    );
  }

  const groups = groupSeries(data.series);
  const nothingFound = data.series.length === 0;

  return (
    <div className='grid gap-6'>
      <p className='text-sm text-muted-foreground' data-testid='recurring-summary'>
        {groups.confirmed.length > 0 ? (
          <>
            <span className='numeric font-semibold text-foreground'>
              {formatMoney(data.confirmedMonthlyTotal, data.baseCurrency)}
            </span>{' '}
            a month across {groups.confirmed.length} confirmed{' '}
            {groups.confirmed.length === 1 ? 'payment' : 'payments'}
            {data.unconvertedConfirmedCount > 0 &&
              `, excluding ${data.unconvertedConfirmedCount} not converted yet`}
            .
          </>
        ) : (
          'Confirm the payments that really repeat. Only confirmed ones will count toward forecasts.'
        )}
      </p>
      {nothingFound ? (
        <EmptyState
          icon={Repeat}
          title='No recurring payments found yet'
          description='Tempo looks for payments to the same place on a regular rhythm. Annual subscriptions can be suggested after two payments; other patterns need at least three.'
        />
      ) : (
        <>
          <SeriesSection
            title='Confirmed'
            series={groups.confirmed}
            baseCurrency={data.baseCurrency}
            empty='Nothing confirmed yet.'
          />
          <SeriesSection
            title='Suggested'
            description='Detected from your history. Confirm or dismiss each one.'
            series={groups.suggested}
            baseCurrency={data.baseCurrency}
            empty='No new suggestions.'
          />
          <CollapsedSection title='Ended' series={groups.ended} baseCurrency={data.baseCurrency} />
          <CollapsedSection
            title='Dismissed'
            series={groups.dismissed}
            baseCurrency={data.baseCurrency}
          />
        </>
      )}
      <IncomeSection asOf={asOf} />
    </div>
  );
}

function SeriesSection({
  title,
  description,
  series,
  baseCurrency,
  empty,
}: {
  title: string;
  description?: string;
  series: RecurringSeries[];
  baseCurrency: string | null;
  empty: string;
}) {
  return (
    <section aria-label={title} className='grid gap-3'>
      <header>
        <h2 className='text-section-title'>
          {title} <span className='text-sm font-normal text-muted-foreground'>{series.length}</span>
        </h2>
        {description && <p className='mt-1 text-sm text-muted-foreground'>{description}</p>}
      </header>
      {series.length === 0 ? (
        <p className='text-sm text-muted-foreground'>{empty}</p>
      ) : (
        <SeriesList series={series} baseCurrency={baseCurrency} />
      )}
    </section>
  );
}

function CollapsedSection({
  title,
  series,
  baseCurrency,
}: {
  title: string;
  series: RecurringSeries[];
  baseCurrency: string | null;
}) {
  if (series.length === 0) return null;
  return (
    <details className='group' aria-label={title}>
      <summary className='flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'>
        {title} ({series.length})
      </summary>
      <div className='mt-3'>
        <SeriesList series={series} baseCurrency={baseCurrency} />
      </div>
    </details>
  );
}

/** Recurring income, folded away: it matters for forecasts, not for this screen's spending view. */
function IncomeSection({asOf}: {asOf: string}) {
  const [open, setOpen] = useState(false);
  const query = useGetRecurringSeries('INCOME', asOf, {enabled: open});
  const {isError} = savedDataStatus(query);
  const series = query.data?.series ?? [];

  return (
    <details
      aria-label='Income'
      className='border-t pt-4'
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className='flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'>
        Recurring income
      </summary>
      <div className='mt-3'>
        {!open ? null : query.data === undefined && !isError ? (
          <Skeleton className='h-16' />
        ) : isError ? (
          <p className='text-sm text-muted-foreground'>
            Recurring income is unavailable right now.
          </p>
        ) : series.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No recurring income found yet.</p>
        ) : (
          <SeriesList series={series} baseCurrency={query.data?.baseCurrency ?? null} />
        )}
      </div>
    </details>
  );
}

function SeriesList({
  series,
  baseCurrency,
}: {
  series: RecurringSeries[];
  baseCurrency: string | null;
}) {
  return (
    <Card className='divide-y divide-border/60 overflow-hidden p-0'>
      <ul className='divide-y divide-border/60'>
        {series.map((entry) => (
          <SeriesRow key={entry.key} series={entry} baseCurrency={baseCurrency} />
        ))}
      </ul>
    </Card>
  );
}

function SeriesRow({series, baseCurrency}: {series: RecurringSeries; baseCurrency: string | null}) {
  const {updateDecision, pendingKey} = useUpdateRecurringSeriesDecision();
  const busy = pendingKey === series.key;
  const cadence = RECURRING_CADENCE_LABELS[series.cadence];
  const showMonthly =
    series.monthlyEquivalent !== null &&
    (series.cadence !== 'MONTHLY' || series.currency !== baseCurrency);
  const decide = (decision: RecurringSeries['decision']) =>
    void updateDecision({key: series.key, decision});

  return (
    <li
      className='grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'
      data-testid={`recurring-series-${series.key}`}
    >
      <div className='min-w-0'>
        <div className='flex items-baseline justify-between gap-3'>
          <Link
            to='/bank-transactions'
            search={{recurringSeriesKey: series.key}}
            className='min-w-0 font-medium break-words underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
            aria-label={`${series.name}, ${series.transactionCount} payments`}
          >
            {series.name}
          </Link>
          <p className='shrink-0 text-right numeric text-sm'>
            {series.amountKind === 'VARIABLE' && '~'}
            {formatMoney(series.typicalAmount, series.currency)}
          </p>
        </div>
        <p className='mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground'>
          <span>{cadence}</span>
          {series.amountKind === 'VARIABLE' && <Badge variant='outline'>Variable amount</Badge>}
          {showMonthly && (
            <span>
              ≈{' '}
              <span className='numeric'>
                {formatMoney(series.monthlyEquivalent!, baseCurrency)}
              </span>{' '}
              a month
            </span>
          )}
          <span>
            {series.status === 'ENDED'
              ? `Last paid ${formatBankTransactionCompactDate(series.lastDate)}`
              : `Next around ${formatBankTransactionCompactDate(series.nextExpectedDate)}`}
          </span>
          {series.flags.includes('LATE') && <Badge variant='secondary'>Late</Badge>}
          {series.flags.includes('PRICE_INCREASED') && (
            <Badge variant='secondary'>
              Price went up to {formatMoney(series.latestAmount, series.currency)}
            </Badge>
          )}
        </p>
      </div>
      <div className='flex gap-2 sm:justify-end'>
        {series.decision === null ? (
          <>
            <Button
              size='sm'
              className='max-sm:h-11 max-sm:flex-1'
              disabled={busy}
              onClick={() => decide('CONFIRMED')}
              aria-label={`Confirm ${series.name}`}
            >
              Confirm
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='max-sm:h-11 max-sm:flex-1'
              disabled={busy}
              onClick={() => decide('DISMISSED')}
              aria-label={`Dismiss ${series.name}`}
            >
              Dismiss
            </Button>
          </>
        ) : (
          <Button
            size='sm'
            variant='ghost'
            className='max-sm:h-11'
            disabled={busy}
            onClick={() => decide(null)}
            aria-label={`Undo ${series.decision === 'CONFIRMED' ? 'confirm' : 'dismiss'} for ${series.name}`}
          >
            Undo
          </Button>
        )}
      </div>
    </li>
  );
}

function RecurringSkeleton() {
  return (
    <div aria-busy='true' aria-label='Loading recurring payments' className='grid gap-4'>
      <Skeleton className='h-4 w-72' />
      <Skeleton className='h-6 w-32' />
      <Card className='grid gap-3 p-4'>
        <Skeleton className='h-12' />
        <Skeleton className='h-12' />
        <Skeleton className='h-12' />
      </Card>
    </div>
  );
}

import {Link} from '@tanstack/react-router';

import {Card} from '@/components/ui/card';
import {BANK_TRANSACTION_UNCATEGORIZED} from '@/features/banking/types/bank-transaction';
import {BANK_TRANSACTION_CATEGORY_META} from '@/features/banking/utils/bank-transaction-category-meta';
import {cn} from '@/utils/cn';

import type {
  BankTransactionSummary,
  BankTransactionSummaryCategory,
} from '../types/bank-transaction-summary';
import {categoryDrill} from '../utils/drill-links';
import {fixedCostLabel, fixedCosts, isFixedCost} from '../utils/fixed-costs';
import {formatMoney, toCents} from '../utils/money';
import {monthDates} from '../utils/month';

type CategoryBreakdownProps = {
  summary: BankTransactionSummary;
  isCurrentMonth: boolean;
};

/** Below this usual amount a percentage is noise, so the change shows the usual amount instead. */
const CHANGE_MIN_USUAL_CENTS = 2000;
/** A change has to move at least this much, in cents and as a share of usual, to be listed. */
const CHANGE_MIN_CENTS = 2000;
const CHANGE_MIN_SHARE = 0.25;
const CHANGES_SHOWN = 3;

/**
 * Everyday categories share a scale, so the bars compare what can change month to month; fixed
 * costs sit on one line above them instead of setting the scale. The tick marks each category's
 * usual amount, and the largest moves against usual are spelled out first.
 */
export function CategoryBreakdown({summary, isCurrentMonth}: CategoryBreakdownProps) {
  const {categories, baseCurrency, through} = summary;
  const {from} = monthDates(summary.month);
  const hasMissing = summary.excluded.missingBaseAmount > 0;
  const fixed = fixedCosts(categories.filter((row) => toCents(row.spending) > 0));
  // The API lists REFUND last; a positive refund bucket ranks with the other spending here.
  const spending = categories
    .filter((row) => toCents(row.spending) > 0 && !isFixedCost(row.category))
    .sort(
      (a, b) => toCents(b.spending) - toCents(a.spending) || a.category.localeCompare(b.category),
    );
  const visible = spending.slice(0, 6);
  const remaining = spending.slice(6);
  const refund = categories.find((row) => row.category === 'REFUND' && toCents(row.spending) < 0);
  const changes = biggestChanges(categories);
  const scale = Math.max(
    1,
    ...visible.flatMap((row) => [toCents(row.spending), toCents(row.baselineAverage ?? '0.00')]),
  );

  return (
    <Card className='grid min-w-0 gap-6 p-5 sm:p-6' data-testid='category-breakdown'>
      <div>
        <h2 className='text-base font-semibold'>Where it went</h2>
        {summary.baseline.months.length > 0 && (
          <p className='mt-1 text-xs text-muted-foreground'>
            {isCurrentMonth
              ? 'Compared with usual by this day of the month.'
              : 'Compared with usual for a full month.'}
          </p>
        )}
      </div>
      {changes.length > 0 && (
        <section
          aria-labelledby='biggest-changes'
          data-testid='biggest-changes'
          className='border-b pb-4'
        >
          <h3 id='biggest-changes' className='text-xs font-medium text-muted-foreground'>
            Biggest changes
          </h3>
          <ul className='mt-2.5 grid gap-2 text-sm'>
            {changes.map(({row, difference, share, usual}) => (
              <li key={row.category}>
                <Link
                  to='/bank-transactions'
                  search={categoryDrill(row.category, from, through, hasMissing)}
                  className='flex items-baseline justify-between gap-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'
                >
                  <span className='min-w-0'>{categoryLabel(row.category)}</span>
                  <span
                    className={cn(
                      'shrink-0 tabular-nums',
                      difference > 0 ? 'text-primary' : 'text-success',
                    )}
                  >
                    {difference > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(difference) / 100, baseCurrency)}
                    <span className='text-muted-foreground'>
                      {' '}
                      {usual === 0
                        ? '(new)'
                        : share === null
                          ? `(usually ${formatMoney(usual / 100, baseCurrency)})`
                          : `(${difference > 0 ? '+' : '−'}${Math.round(share * 100)}%)`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {visible.length === 0 && fixed.rows.length === 0 && !refund && (
        <p className='text-sm text-muted-foreground'>No spending this month.</p>
      )}
      <div className='grid gap-5' data-testid='category-rows'>
        {fixed.rows.length > 0 && (
          <Link
            to='/bank-transactions'
            search={categoryDrill(
              fixed.rows.map((row) => row.category),
              from,
              through,
              hasMissing,
            )}
            className='group block border-b pb-4 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring'
          >
            <div className='flex items-baseline justify-between gap-3 text-sm'>
              <span className='min-w-0 group-hover:underline'>Fixed costs</span>
              <span className='shrink-0 font-mono tabular-nums'>
                {formatMoney(fixed.spent / 100, baseCurrency)}
              </span>
            </div>
            <p className='mt-1 text-xs text-muted-foreground'>{fixedCostLabel(fixed.rows)}</p>
          </Link>
        )}
        {visible.map((row) => {
          const meta =
            row.category === BANK_TRANSACTION_UNCATEGORIZED
              ? null
              : BANK_TRANSACTION_CATEGORY_META[row.category];
          const usual = row.baselineAverage === null ? null : toCents(row.baselineAverage);
          const spent = toCents(row.spending);
          return (
            <Link
              key={row.category}
              to='/bank-transactions'
              search={categoryDrill(row.category, from, through, hasMissing)}
              className='group block outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring'
            >
              <div className='flex items-baseline justify-between gap-3 text-sm'>
                <span className='min-w-0 group-hover:underline'>{categoryLabel(row.category)}</span>
                <span className='shrink-0 font-mono tabular-nums'>
                  {formatMoney(row.spending, baseCurrency)}
                </span>
              </div>
              <div
                className={cn(
                  'relative mt-2 h-1.5 rounded-full',
                  meta?.colorClassName ?? 'bg-muted text-muted-foreground',
                )}
              >
                <span
                  aria-hidden='true'
                  className='absolute inset-y-0 left-0 rounded-full bg-current'
                  style={{width: `${(spent / scale) * 100}%`}}
                />
                {usual !== null && (
                  <span
                    role='img'
                    aria-label={`Usual spending: ${formatMoney(row.baselineAverage!, baseCurrency)}`}
                    className='absolute -top-1 h-3.5 w-px -translate-x-1/2 bg-foreground/70'
                    style={{left: `${(Math.max(0, usual) / scale) * 100}%`}}
                  />
                )}
              </div>
              <p className='mt-1.5 text-xs text-muted-foreground'>
                {row.count} {row.count === 1 ? 'transaction' : 'transactions'}
                {row.baselineAverage !== null &&
                  ` · usually ${formatMoney(row.baselineAverage, baseCurrency)}`}
              </p>
            </Link>
          );
        })}
        {remaining.length > 0 && (
          <Link
            to='/bank-transactions'
            search={categoryDrill(
              remaining.map((row) => row.category),
              from,
              through,
              hasMissing,
            )}
            className='w-fit text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'
          >
            {remaining.length} more {remaining.length === 1 ? 'category' : 'categories'}{' '}
            <span aria-hidden='true'>→</span>
          </Link>
        )}
        {refund && (
          <Link
            to='/bank-transactions'
            search={categoryDrill('REFUND', from, through, hasMissing)}
            className='border-t pt-4 text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'
          >
            <div className='flex items-baseline justify-between gap-3'>
              <span>Refunds (subtracted)</span>
              <span className='shrink-0 font-mono tabular-nums'>
                {formatMoney(refund.spending, baseCurrency)}
              </span>
            </div>
            <p className='mt-1 text-xs text-muted-foreground'>
              {refund.count} {refund.count === 1 ? 'transaction' : 'transactions'}
            </p>
          </Link>
        )}
      </div>
    </Card>
  );
}

function categoryLabel(category: BankTransactionSummaryCategory['category']) {
  return category === BANK_TRANSACTION_UNCATEGORIZED
    ? 'Uncategorized'
    : BANK_TRANSACTION_CATEGORY_META[category].label;
}

/** Everyday categories that moved most against usual, by amount, new spending included. */
function biggestChanges(categories: BankTransactionSummaryCategory[]) {
  return categories
    .filter((row) => row.baselineAverage !== null && !isFixedCost(row.category))
    .map((row) => {
      const usual = toCents(row.baselineAverage!);
      const difference = toCents(row.spending) - usual;
      const share = usual >= CHANGE_MIN_USUAL_CENTS ? Math.abs(difference) / usual : null;
      return {row, usual, difference, share};
    })
    .filter(
      ({difference, share}) =>
        Math.abs(difference) >= CHANGE_MIN_CENTS && (share === null || share >= CHANGE_MIN_SHARE),
    )
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, CHANGES_SHOWN);
}

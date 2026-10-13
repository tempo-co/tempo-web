import {Link, useNavigate} from '@tanstack/react-router';
import {format, parse} from 'date-fns';
import {useState} from 'react';
import {Bar, BarChart, CartesianGrid, Cell, ReferenceArea, XAxis, YAxis} from 'recharts';

import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {ChartContainer, ChartTooltip} from '@/components/ui/chart';
import {Skeleton} from '@/components/ui/skeleton';
import {ToggleGroup, ToggleGroupItem} from '@/components/ui/toggle-group';
import {useIsMobile} from '@/hooks/use-is-mobile';
import {cn} from '@/utils/cn';

import {useGetBankTransactionCashFlow} from '../api/use-get-bank-transaction-cash-flow';
import type {CashFlowMonth} from '../types/bank-transaction-cash-flow';
import {formatMoney, toCents} from '../utils/money';
import {currentMonth, formatMonth, localDate, shiftMonth} from '../utils/month';

type Range = '12' | '24';

const parseMonth = (month: string) => parse(month, 'yyyy-MM', new Date());
const shortMonth = (month: string) => format(parseMonth(month), 'MMM');
const monthSearch = (month: string) => (month === currentMonth() ? {} : {month});

/** Four equal, round steps that cover the tallest bar, so gridlines read as a ruler. */
function axisTicks(cents: number) {
  const rough = Math.max(cents / 100, 100) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= rough)! * magnitude;
  return [0, 1, 2, 3, 4].map((index) => index * step);
}

const compact = new Intl.NumberFormat(undefined, {notation: 'compact', maximumFractionDigits: 1});

/** Opaque, so the selected-month band never tints income into a different-looking series. */
const incomeSwatch = 'bg-[hsl(37_16%_72%)] dark:bg-[hsl(36_6%_40%)]';

/**
 * Spending and income per month on one fixed scale, so months and years compare directly.
 * Selecting a month moves the rest of Home to it.
 */
export function CashFlowCard({month}: {month: string}) {
  const thisMonth = currentMonth();
  // The window ends at the current month, or at the selected month once it falls out of view.
  const [range, setRange] = useState<Range>('12');
  const span = Number(range);
  const windowEnd = month > shiftMonth(thisMonth, -span) ? thisMonth : shiftMonth(month, span - 1);
  // Always load a year more than shown, so each month can compare with the same month a year before.
  const from = shiftMonth(windowEnd, -(span + 11));
  const {cashFlow, isPending, isError, refetch} = useGetBankTransactionCashFlow(
    from,
    windowEnd,
    localDate(),
  );

  if (isPending) return <Skeleton className='h-[26rem]' aria-label='Loading cash flow' />;
  if (isError || !cashFlow) {
    return (
      <Card className='grid justify-items-start gap-4 p-5 sm:p-6'>
        <p>Could not load cash flow.</p>
        <Button variant='outline' onClick={() => void refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  const byMonth = new Map(cashFlow.months.map((row) => [row.month, row]));
  const windowStart = shiftMonth(windowEnd, -(span - 1));
  const visible = cashFlow.months.filter((row) => row.month >= windowStart);

  return (
    <Card className='@container grid min-w-0 gap-5 p-5 sm:p-6' data-testid='cash-flow'>
      <header className='flex flex-wrap items-start justify-between gap-x-6 gap-y-3'>
        <div className='min-w-0'>
          <h2 className='text-base font-semibold'>Cash flow</h2>
          <Averages months={visible} thisMonth={thisMonth} currency={cashFlow.baseCurrency} />
        </div>
        <ToggleGroup
          type='single'
          variant='outline'
          size='sm'
          value={range}
          onValueChange={(value) => value && setRange(value as Range)}
          aria-label='Months shown'
        >
          {(['12', '24'] as const).map((value) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={value === '12' ? '12 months' : '24 months'}
              className='min-h-9 px-3 font-mono text-xs data-[state=on]:bg-secondary data-[state=on]:font-semibold data-[state=on]:text-secondary-foreground'
            >
              {value === '12' ? '1Y' : '2Y'}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>
      {visible.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No synced months in this period yet.</p>
      ) : (
        <CashFlowChart
          months={visible}
          selected={month}
          thisMonth={thisMonth}
          currency={cashFlow.baseCurrency}
          dense={span > 12}
        />
      )}
      <YearOverYear
        month={month}
        current={byMonth.get(month)}
        lastYear={byMonth.get(shiftMonth(month, -12))}
        isCurrentMonth={month === thisMonth}
        currency={cashFlow.baseCurrency}
      />
    </Card>
  );
}

/** Averages over complete months only; the current month is still filling in. */
function Averages({
  months,
  thisMonth,
  currency,
}: {
  months: CashFlowMonth[];
  thisMonth: string;
  currency: string | null;
}) {
  const complete = months.filter((row) => row.month !== thisMonth);
  if (complete.length === 0) return null;
  const sum = (key: 'spending' | 'income') =>
    complete.reduce((total, row) => total + toCents(row[key]), 0);
  const spent = sum('spending');
  const earned = sum('income');
  const saved = earned - spent;
  const rate = earned > 0 ? Math.round((saved / earned) * 100) : null;
  return (
    <p className='mt-1 text-xs text-muted-foreground'>
      Monthly average over {complete.length} {complete.length === 1 ? 'month' : 'months'}:{' '}
      <span className='font-mono text-foreground tabular-nums'>
        {formatMoney(spent / complete.length / 100, currency)}
      </span>{' '}
      spent
      {rate !== null && (
        <>
          {' · '}
          <span
            className={cn('font-mono tabular-nums', saved > 0 ? 'text-success' : 'text-foreground')}
          >
            {rate}%
          </span>{' '}
          of income {saved >= 0 ? 'kept' : 'overspent'}
        </>
      )}
    </p>
  );
}

function CashFlowChart({
  months,
  selected,
  thisMonth,
  currency,
  dense,
}: {
  months: CashFlowMonth[];
  selected: string;
  thisMonth: string;
  currency: string | null;
  dense: boolean;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const ticks = axisTicks(
    Math.max(...months.flatMap((row) => [toCents(row.spending), toCents(row.income)])),
  );
  const data = months.map((row) => ({
    month: row.month,
    spending: Number(row.spending),
    income: Number(row.income),
  }));
  // Every month on a wide chart, fewer on phones and for two years. The selected month always
  // gets its label and clears its neighbours; the first label of each year carries the year.
  const labelEvery = (dense ? 3 : 1) * (isMobile ? 2 : 1);
  const selectedIndex = months.findIndex((row) => row.month === selected);
  const labelled = new Set(
    months
      .map((row, index) => ({row, index}))
      .filter(({row, index}) =>
        row.month === selected
          ? true
          : selectedIndex >= 0 && Math.abs(index - selectedIndex) < labelEvery
            ? false
            : (months.length - 1 - index) % labelEvery === 0,
      )
      .map(({row}) => row.month),
  );
  const yearLabels = new Set(
    [...labelled].filter(
      (month, index, list) => index === 0 || list[index - 1].slice(0, 4) !== month.slice(0, 4),
    ),
  );
  const select = (month: string) => void navigate({to: '/', search: monthSearch(month)});

  return (
    <div>
      <ChartContainer
        className='aspect-auto h-64 w-full'
        config={{
          spending: {color: 'hsl(var(--primary))'},
          income: {theme: {light: 'hsl(37 16% 72%)', dark: 'hsl(36 6% 40%)'}},
        }}
        aria-label={`Spending and income per month, ${formatMonth(months[0].month)} to ${formatMonth(months[months.length - 1].month)}. Select a month in the table below to open it.`}
      >
        <BarChart
          data={data}
          margin={{left: 0, right: 0, top: 8, bottom: 0}}
          barGap={1}
          barCategoryGap={dense ? '16%' : '22%'}
          onClick={(state) => {
            const index = Number(state.activeTooltipIndex);
            if (Number.isInteger(index) && data[index]) select(data[index].month);
          }}
          className='cursor-pointer'
        >
          <defs>
            <pattern
              id='cash-flow-so-far'
              width='4'
              height='4'
              patternUnits='userSpaceOnUse'
              patternTransform='rotate(45)'
            >
              <rect width='4' height='4' fill='var(--color-spending)' fillOpacity={0.35} />
              <line y2='4' stroke='var(--color-spending)' strokeWidth={2.5} />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke='hsl(var(--border))' />
          {months.some((row) => row.month === selected) && (
            <ReferenceArea
              x1={selected}
              x2={selected}
              fill='hsl(var(--foreground))'
              fillOpacity={0.09}
              ifOverflow='visible'
            />
          )}
          <XAxis
            dataKey='month'
            tickLine={false}
            axisLine={false}
            interval={0}
            height={34}
            tick={(props) => {
              const month = String(props.payload.value);
              if (!labelled.has(month)) return <g />;
              const startsYear = yearLabels.has(month);
              return (
                <text
                  x={props.x}
                  y={Number(props.y) + 12}
                  textAnchor='middle'
                  className={cn(
                    'text-[11px]',
                    month === selected ? 'fill-primary font-semibold' : 'fill-muted-foreground',
                  )}
                >
                  {shortMonth(month)}
                  {startsYear && (
                    <tspan
                      x={props.x}
                      dy={13}
                      className='fill-muted-foreground text-[10px] font-normal'
                    >
                      {month.slice(0, 4)}
                    </tspan>
                  )}
                </text>
              );
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, ticks[ticks.length - 1]]}
            ticks={ticks}
            interval={0}
            tickFormatter={(value: number) => compact.format(value)}
          />
          <ChartTooltip
            cursor={{fill: 'hsl(var(--foreground))', fillOpacity: 0.04}}
            content={({active, label}) => {
              const row = months.find((item) => item.month === label);
              if (!active || !row) return null;
              const net = toCents(row.net);
              return (
                <div className='grid min-w-44 gap-1 border bg-card p-2.5 text-xs shadow-sm'>
                  <p className='font-semibold'>
                    {formatMonth(row.month)}
                    {row.month === thisMonth && (
                      <span className='font-normal text-muted-foreground'> · so far</span>
                    )}
                  </p>
                  <TooltipRow
                    label='Income'
                    value={formatMoney(row.income, currency)}
                    swatch={incomeSwatch}
                  />
                  <TooltipRow
                    label='Spent'
                    value={formatMoney(row.spending, currency)}
                    swatch='bg-primary'
                  />
                  <TooltipRow
                    label={net >= 0 ? 'Kept' : 'Overspent'}
                    value={formatMoney(Math.abs(net) / 100, currency)}
                    className={net > 0 ? 'text-success' : undefined}
                  />
                </div>
              );
            }}
          />
          <Bar dataKey='income' fill='var(--color-income)' isAnimationActive={false} />
          <Bar dataKey='spending' fill='var(--color-spending)' isAnimationActive={false}>
            {data.map((row) => (
              <Cell
                key={row.month}
                fill={row.month === thisMonth ? 'url(#cash-flow-so-far)' : 'var(--color-spending)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground'>
        <span className='flex items-center gap-1.5'>
          <i className={cn('size-2.5', incomeSwatch)} />
          Income
        </span>
        <span className='flex items-center gap-1.5'>
          <i className='size-2.5 bg-primary' />
          Spent
        </span>
        {months.some((row) => row.month === thisMonth) && (
          <span className='flex items-center gap-1.5'>
            <i className='size-2.5 bg-[repeating-linear-gradient(135deg,hsl(var(--primary))_0_1.5px,transparent_1.5px_3px)] ring-1 ring-primary/40 ring-inset' />
            {shortMonth(thisMonth)} so far
          </span>
        )}
      </div>
      <div className='sr-only focus-within:not-sr-only focus-within:mt-4 focus-within:max-w-full focus-within:overflow-x-auto'>
        <table
          aria-label='Spending and income per month'
          className='w-full text-right text-sm [&_td]:px-2 [&_td]:py-1 [&_td]:font-mono [&_td]:tabular-nums [&_th]:px-2 [&_th]:py-2'
        >
          <thead>
            <tr>
              <th className='text-left'>Month</th>
              <th>Spent</th>
              <th>Income</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {months.map((row) => (
              <tr key={row.month}>
                <td className='text-left'>
                  <Link
                    to='/'
                    search={monthSearch(row.month)}
                    className='underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                  >
                    {formatMonth(row.month)}
                  </Link>
                </td>
                <td>{formatMoney(row.spending, currency)}</td>
                <td>{formatMoney(row.income, currency)}</td>
                <td>{formatMoney(row.net, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  swatch,
  className,
}: {
  label: string;
  value: string;
  swatch?: string;
  className?: string;
}) {
  return (
    <p className='flex items-center justify-between gap-4'>
      <span className='flex items-center gap-1.5 text-muted-foreground'>
        {swatch && <i className={cn('size-2', swatch)} />}
        {label}
      </span>
      <span className={cn('font-mono tabular-nums', className)}>{value}</span>
    </p>
  );
}

/** The selected month against the same month a year earlier, both as whole months. */
function YearOverYear({
  month,
  current,
  lastYear,
  isCurrentMonth,
  currency,
}: {
  month: string;
  current: CashFlowMonth | undefined;
  lastYear: CashFlowMonth | undefined;
  isCurrentMonth: boolean;
  currency: string | null;
}) {
  const previous = shiftMonth(month, -12);
  const previousName = formatMonth(previous);
  if (!lastYear) {
    return (
      <p className='border-t pt-4 text-xs text-muted-foreground'>
        No {previousName} to compare with yet.
      </p>
    );
  }
  if (isCurrentMonth || !current) {
    return (
      <p className='border-t pt-4 text-sm text-muted-foreground'>
        Same month last year, {previousName}: spent{' '}
        <span className='font-mono text-foreground tabular-nums'>
          {formatMoney(lastYear.spending, currency)}
        </span>
        , kept{' '}
        <span className='font-mono text-foreground tabular-nums'>
          {formatMoney(lastYear.net, currency)}
        </span>
      </p>
    );
  }
  const difference = toCents(current.spending) - toCents(lastYear.spending);
  const percent = Math.round(
    (Math.abs(difference) / Math.max(1, toCents(lastYear.spending))) * 100,
  );
  return (
    <div className='flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t pt-4 text-sm'>
      <p>
        <span className='text-muted-foreground'>vs {previousName}: </span>
        <span
          className={cn(
            'font-medium',
            difference > 0 ? 'text-primary' : difference < 0 && 'text-success',
          )}
        >
          {difference === 0
            ? 'the same spending'
            : `${formatMoney(Math.abs(difference) / 100, currency)} ${difference > 0 ? 'more' : 'less'} spent (${difference > 0 ? '+' : '−'}${percent}%)`}
        </span>
      </p>
      <p className='text-xs text-muted-foreground'>
        Then{' '}
        <span className='font-mono tabular-nums'>{formatMoney(lastYear.spending, currency)}</span>{' '}
        spent ·{' '}
        <span className='font-mono tabular-nums'>{formatMoney(lastYear.income, currency)}</span>{' '}
        income
      </p>
    </div>
  );
}

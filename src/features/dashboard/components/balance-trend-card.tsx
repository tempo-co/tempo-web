import {format, startOfWeek, subWeeks} from 'date-fns';
import {useState} from 'react';
import {Area, AreaChart, CartesianGrid, XAxis, YAxis} from 'recharts';

import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {ChartContainer, ChartTooltip} from '@/components/ui/chart';
import {Skeleton} from '@/components/ui/skeleton';
import {ToggleGroup, ToggleGroupItem} from '@/components/ui/toggle-group';
import type {BankConnection} from '@/features/banking/types/bank-connection';
import {resolveBankAccountLabel} from '@/features/banking/utils/formatters';
import {useIsMobile} from '@/hooks/use-is-mobile';
import {cn} from '@/utils/cn';

import {useGetBankBalanceTrend} from '../api/use-get-bank-balance-trend';
import type {BalanceTrendPeriod} from '../types/bank-balance-trend';
import type {CashFlowInterval} from '../types/bank-transaction-cash-flow';
import {axisFormatter, axisTicks} from '../utils/chart-axis';
import {parseCalendarDate} from '../utils/drill-links';
import {formatMoney, toCents} from '../utils/money';
import {currentMonth, formatMonth, localDate, shiftMonth} from '../utils/month';

const INTERVALS: {value: CashFlowInterval; label: string}[] = [
  {value: 'week', label: 'Week'},
  {value: 'month', label: 'Month'},
  {value: 'year', label: 'Year'},
];
const WEEKS_SHOWN = 26;
const WEEKS_SHOWN_PHONE = 13;
const MONTHS_SHOWN = 12;
const YEARS_SHOWN = 10;

const day = (value: string) => parseCalendarDate(value);

function requestRange(interval: CashFlowInterval) {
  const today = localDate();
  if (interval === 'week') {
    const thisWeek = startOfWeek(day(today), {weekStartsOn: 1});
    return {from: format(subWeeks(thisWeek, WEEKS_SHOWN - 1), 'yyyy-MM-dd'), to: today};
  }
  if (interval === 'year')
    return {from: `${Number(today.slice(0, 4)) - (YEARS_SHOWN - 1)}-01-01`, to: today};
  return {from: `${shiftMonth(currentMonth(), -(MONTHS_SHOWN - 1))}-01`, to: today};
}

/** "31 Aug 2026" for a past period's end; "today" while it is running. */
function pointName(period: BalanceTrendPeriod) {
  return period.complete ? format(day(period.end), 'd MMM yyyy') : 'Today';
}

function startName(period: BalanceTrendPeriod, interval: CashFlowInterval) {
  if (interval === 'year') return `end of ${period.start.slice(0, 4)}`;
  if (interval === 'month') return `end of ${formatMonth(period.start.slice(0, 7))}`;
  return format(day(period.end), 'd MMM');
}

/** Whole amounts: a balance line is about direction and size, not cents. */
function wholeMoney(currency: string | null) {
  const whole = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    ...(currency ? {style: 'currency', currency} : {}),
  });
  return (value: string | number) => whole.format(Number(value));
}

/**
 * The combined balance of the connected accounts at the end of each week, month or year, on an
 * axis from zero so growth reads at its true size.
 */
export function BalanceTrendCard({connections}: {connections: BankConnection[]}) {
  const [interval, setGrouping] = useState<CashFlowInterval>('month');
  const isMobile = useIsMobile();
  const {from, to} = requestRange(interval);
  const {balanceTrend, isPending, isError, refetch} = useGetBankBalanceTrend(
    interval,
    from,
    to,
    localDate(),
  );
  const loaded = balanceTrend?.interval === interval ? balanceTrend : undefined;
  const periods = (() => {
    const withTotal = (loaded?.periods ?? []).filter((period) => period.total !== null);
    return interval === 'week'
      ? withTotal.slice(-(isMobile ? WEEKS_SHOWN_PHONE : WEEKS_SHOWN))
      : withTotal;
  })();
  const labels = new Map(
    connections.flatMap((connection) =>
      connection.bankAccounts.map((account) => [account.id, resolveBankAccountLabel(account)]),
    ),
  );

  return (
    <Card className='@container grid min-w-0 gap-5 p-5 sm:p-6' data-testid='balance-trend'>
      <header className='flex flex-wrap items-start justify-between gap-x-6 gap-y-3'>
        <div className='min-w-0'>
          <h2 className='text-base font-semibold'>Total balance</h2>
          {loaded && periods.length > 1 && (
            <Change periods={periods} interval={interval} currency={loaded.baseCurrency} />
          )}
        </div>
        <ToggleGroup
          type='single'
          variant='outline'
          size='sm'
          value={interval}
          onValueChange={(value) => value && setGrouping(value as CashFlowInterval)}
          aria-label='Show total balance by'
        >
          {INTERVALS.map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              className='min-h-9 px-3 text-xs data-[state=on]:bg-secondary data-[state=on]:font-semibold data-[state=on]:text-secondary-foreground'
            >
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>
      {isError && !loaded ? (
        <div className='grid justify-items-start gap-3'>
          <p className='text-sm'>Could not load the balance trend.</p>
          <Button variant='outline' size='sm' onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isPending || !loaded ? (
        <Skeleton className='h-[17rem]' role='img' aria-label='Loading total balance' />
      ) : periods.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          {loaded.baseCurrency
            ? 'No balance history yet.'
            : 'The balance trend appears once Tempo has picked a base currency.'}
        </p>
      ) : (
        <>
          <BalanceChart
            periods={periods}
            interval={interval}
            currency={loaded.baseCurrency}
            labels={labels}
          />
          <LateAccounts
            accounts={loaded.accounts}
            periods={periods}
            interval={interval}
            labels={labels}
          />
        </>
      )}
    </Card>
  );
}

/** The latest total and how far it moved since the first point shown. */
function Change({
  periods,
  interval,
  currency,
}: {
  periods: BalanceTrendPeriod[];
  interval: CashFlowInterval;
  currency: string | null;
}) {
  const first = periods[0];
  const last = periods[periods.length - 1];
  // Only accounts already counted at the first point, so an account joining is not growth.
  const held = new Set(
    first.accounts.filter((account) => account.balance !== null).map((account) => account.id),
  );
  const sumHeld = (period: BalanceTrendPeriod) =>
    period.accounts.reduce(
      (sum, account) =>
        held.has(account.id) && account.balance !== null ? sum + toCents(account.balance) : sum,
      0,
    );
  const difference = sumHeld(last) - sumHeld(first);
  const base = Math.abs(sumHeld(first));
  const percent = base > 0 ? Math.round((Math.abs(difference) / base) * 100) : null;
  return (
    <p className='mt-1 text-xs text-muted-foreground'>
      <span className='font-mono font-medium text-foreground tabular-nums'>
        {formatMoney(last.total!, currency)}
      </span>{' '}
      {last.complete ? `on ${pointName(last)}` : 'today'} ·{' '}
      <span
        className={cn(
          'font-mono font-medium tabular-nums',
          difference > 0 ? 'text-success' : 'text-foreground',
        )}
      >
        {difference >= 0 ? '+' : '−'}
        {formatMoney(Math.abs(difference) / 100, currency)}
        {percent !== null && ` (${difference >= 0 ? '+' : '−'}${percent}%)`}
      </span>{' '}
      <span className='whitespace-nowrap'>since {startName(first, interval)}</span>
    </p>
  );
}

/** Accounts whose history starts inside the window make the line jump; say so. */
function LateAccounts({
  accounts,
  periods,
  interval,
  labels,
}: {
  accounts: {id: string; since: string}[];
  periods: BalanceTrendPeriod[];
  interval: CashFlowInterval;
  labels: Map<string, string>;
}) {
  const late = accounts
    .filter(
      (account) =>
        account.since > periods[0].end && account.since <= periods[periods.length - 1].end,
    )
    .map((account) => ({id: account.id, joined: {start: account.since}}));
  if (late.length === 0) return null;
  return (
    <p className='-mt-2 text-xs text-muted-foreground'>
      {late
        .map(
          ({id, joined}) =>
            `${labels.get(id) ?? 'An account'} counts from ${
              interval === 'year'
                ? joined.start.slice(0, 4)
                : interval === 'month'
                  ? formatMonth(joined.start.slice(0, 7))
                  : format(day(joined.start), 'd MMM')
            }`,
        )
        .join(' · ')}
      , when its history in Tempo starts, and is left out of the change.
    </p>
  );
}

function BalanceChart({
  periods,
  interval,
  currency,
  labels,
}: {
  periods: BalanceTrendPeriod[];
  interval: CashFlowInterval;
  currency: string | null;
  labels: Map<string, string>;
}) {
  const axis = axisFormatter(currency);
  const money = wholeMoney(currency);
  const totals = periods.map((period) => toCents(period.total!));
  const ticks = axisTicks(Math.min(...totals), Math.max(...totals));
  const isMobile = useIsMobile();
  const data = periods.map((period) => ({start: period.start, total: Number(period.total)}));
  const last = periods[periods.length - 1];
  // Labelled like the cash flow chart above: counted back from the latest, years under months.
  const labelEvery = interval === 'year' ? 1 : interval === 'week' ? 4 : isMobile ? 2 : 1;
  const labelled = periods
    .filter((_, index) => (periods.length - 1 - index) % labelEvery === 0)
    .map((period) => period.start);
  const firstOfYear = new Set(
    labelled.filter(
      (start, index) => index === 0 || labelled[index - 1].slice(0, 4) !== start.slice(0, 4),
    ),
  );
  const tickLabel = (start: string) =>
    interval === 'year'
      ? start.slice(0, 4)
      : interval === 'month'
        ? format(day(start), 'MMM')
        : format(day(start), 'd MMM');

  return (
    <div>
      <ChartContainer
        className='aspect-auto h-56 w-full'
        config={{total: {color: 'hsl(var(--primary))'}}}
        role='img'
        aria-label={`Total balance at the end of each ${interval}, ${pointName(periods[0])} to ${pointName(last)}. The table below lists every point.`}
      >
        <AreaChart data={data} margin={{left: 0, right: 18, top: 8, bottom: 0}}>
          <defs>
            <linearGradient id='balance-trend-fill' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='var(--color-total)' stopOpacity={0.22} />
              <stop offset='100%' stopColor='var(--color-total)' stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke='hsl(var(--border))' />
          <XAxis
            dataKey='start'
            tickLine={false}
            axisLine={false}
            interval={0}
            height={interval === 'month' ? 34 : 22}
            // Points sit in the middle of each period's slot, over the cash flow bars above.
            scale='band'
            tick={(props) => {
              const start = String(props.payload.value);
              if (!labelled.includes(start)) return <g />;
              return (
                <text
                  x={props.x}
                  y={Number(props.y) + 12}
                  textAnchor='middle'
                  className='fill-muted-foreground text-[11px]'
                >
                  {tickLabel(start)}
                  {interval === 'month' && firstOfYear.has(start) && (
                    <tspan x={props.x} dy={13} className='text-[10px]'>
                      {start.slice(0, 4)}
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
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            interval={0}
            tick={{className: 'font-mono'}}
            tickFormatter={(value: number) => axis.format(value)}
          />
          <ChartTooltip
            cursor={{stroke: 'hsl(var(--foreground))', strokeOpacity: 0.2}}
            content={({active, label}) => {
              const period = periods.find((item) => item.start === label);
              if (!active || !period) return null;
              return (
                <div className='grid min-w-48 gap-1 border bg-card p-2.5 text-xs shadow-sm'>
                  <p className='flex items-baseline justify-between gap-4 font-semibold'>
                    {pointName(period)}
                    <span className='font-mono tabular-nums'>{money(period.total!)}</span>
                  </p>
                  {period.accounts.map((account) => (
                    <p key={account.id} className='flex items-center justify-between gap-4'>
                      <span className='truncate text-muted-foreground'>
                        {labels.get(account.id) ?? 'Bank account'}
                      </span>
                      <span className='font-mono tabular-nums'>
                        {account.balance === null ? '–' : money(account.balance)}
                      </span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Area
            dataKey='total'
            type='linear'
            stroke='var(--color-total)'
            strokeWidth={2}
            fill='url(#balance-trend-fill)'
            isAnimationActive={false}
            dot={(props: {cx?: number; cy?: number; index?: number}) =>
              props.index === periods.length - 1 && !last.complete ? (
                <circle
                  key='today'
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  className='fill-card stroke-primary'
                  strokeWidth={2}
                />
              ) : (
                <g key={props.index} />
              )
            }
            activeDot={{r: 3.5, strokeWidth: 0}}
          />
        </AreaChart>
      </ChartContainer>
      <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground'>
        <span>Balance at the end of each {interval}</span>
        {!last.complete && (
          <span className='flex items-center gap-1.5'>
            <i className='size-2.5 rounded-full border-2 border-primary' />
            Today
          </span>
        )}
      </div>
      <div className='sr-only'>
        <table
          aria-label={`Total balance per ${interval}`}
          className='w-full text-right text-sm [&_td]:px-2 [&_td]:py-1 [&_td]:font-mono [&_td]:tabular-nums [&_th]:px-2 [&_th]:py-2'
        >
          <thead>
            <tr>
              <th className='text-left'>Date</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.start}>
                <td className='text-left'>{pointName(period)}</td>
                <td>{money(period.total!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

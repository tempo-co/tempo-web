import {Link} from '@tanstack/react-router';
import {ChevronLeft, ChevronRight} from 'lucide-react';

import {Button} from '@/components/ui/button';

import {currentMonth, formatMonth, shiftMonth} from '../utils/month';

type MonthNavigationProps = {
  month: string;
  isCurrentMonth: boolean;
};

/** The current month has no `month` param, so `/` always opens it. */
function monthSearch(month: string) {
  return month === currentMonth() ? {} : {month};
}

const arrowClassName = 'h-11 w-11 sm:h-9 sm:w-9';

export function MonthNavigation({month, isCurrentMonth}: MonthNavigationProps) {
  return (
    <div className='flex flex-wrap items-center gap-1'>
      <Button asChild variant='outline' size='icon' className={arrowClassName}>
        <Link to='/' search={monthSearch(shiftMonth(month, -1))} aria-label='Previous month'>
          <ChevronLeft aria-hidden='true' />
        </Link>
      </Button>
      <h1 className='min-w-[9.5ch] text-center text-2xl leading-tight font-semibold'>
        {formatMonth(month)}
      </h1>
      {isCurrentMonth ? (
        <Button
          variant='outline'
          size='icon'
          className={arrowClassName}
          aria-label='Next month'
          disabled
        >
          <ChevronRight aria-hidden='true' />
        </Button>
      ) : (
        <>
          <Button asChild variant='outline' size='icon' className={arrowClassName}>
            <Link to='/' search={monthSearch(shiftMonth(month, 1))} aria-label='Next month'>
              <ChevronRight aria-hidden='true' />
            </Link>
          </Button>
          <Link
            to='/'
            search={{}}
            className='ml-2.5 text-[0.8125rem] font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline'
          >
            Back to this month
          </Link>
        </>
      )}
    </div>
  );
}

import {createFileRoute} from '@tanstack/react-router';

import {AppBodyLayout} from '@/components/shared/layout/app-body';
import {RecurringSeriesOverview} from '@/features/banking/components/recurring-series-overview';
import {useLocalDate} from '@/hooks/use-local-date';
import {handleAuthenticatedRedirect} from '@/utils/handle-redirect';

export const Route = createFileRoute('/recurring/')({
  component: RecurringIndex,
  beforeLoad: ({context}) => {
    handleAuthenticatedRedirect(context);
  },
});

function RecurringIndex() {
  const asOf = useLocalDate();
  return (
    <AppBodyLayout className='max-md:my-6'>
      <div className='mx-auto grid max-w-3xl gap-4'>
        <h1 className='text-page-title'>Recurring</h1>
        <RecurringSeriesOverview asOf={asOf} />
      </div>
    </AppBodyLayout>
  );
}

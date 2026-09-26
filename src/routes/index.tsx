import {createFileRoute} from '@tanstack/react-router';

import {AppHeaderLayout} from '@/components/shared/layout/app-header-layout';
import {BankCashFlowExplorer} from '@/features/banking/components/bank-cash-flow-explorer';
import {handleAuthenticatedRedirect} from '@/utils/handle-redirect';

export const Route = createFileRoute('/')({
  component: Index,
  beforeLoad: ({context}) => {
    handleAuthenticatedRedirect(context);
  },
});

function Index() {
  return (
    <>
      <AppHeaderLayout>
        <span className='text-sm font-medium'>Home</span>
      </AppHeaderLayout>
      <BankCashFlowExplorer />
    </>
  );
}

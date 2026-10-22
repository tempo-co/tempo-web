import {createFileRoute} from '@tanstack/react-router';

import {ApiTokenSettings} from '@/features/settings/components/api-tokens/api-token-settings';

export const Route = createFileRoute('/settings/api-tokens/')({
  component: ApiTokenSettings,
});

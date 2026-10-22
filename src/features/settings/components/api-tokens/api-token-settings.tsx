import {format} from 'date-fns';
import {KeyRound} from 'lucide-react';

import {EmptyState} from '@/components/shared/layout/app-empty-state';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';

import {usePersonalAccessTokens} from '../../api/use-personal-access-tokens';
import {SettingsGroup, SettingsList, SettingsRow} from '../settings-group';
import {CreateTokenDialog} from './create-token-dialog';
import {RevokeTokenDialog} from './revoke-token-dialog';

export function ApiTokenSettings() {
  const {data: tokens, isPending, isError, refetch} = usePersonalAccessTokens();
  return (
    <SettingsGroup
      id='api-tokens-heading'
      title='API tokens'
      description='Read-only access to your Tempo data. Tokens do not expire; revoke them when no longer needed.'
    >
      <div className='space-y-4'>
        {isPending && <Skeleton className='h-24 w-full rounded-card border bg-card' />}
        {isError && (
          <EmptyState
            icon={KeyRound}
            tone='error'
            title='API tokens could not be loaded.'
            description='Check your connection and try again.'
          >
            <Button variant='outline' onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        )}
        {tokens?.length === 0 && (
          <EmptyState
            icon={KeyRound}
            title='No API tokens yet.'
            description='Create a token to connect a read-only integration.'
          />
        )}
        <SettingsList>
          {tokens?.map((token) => (
            <div
              key={token.id}
              data-testid='api-token-row'
              className='flex items-center justify-between gap-4 px-4 py-3'
            >
              <div className='min-w-0 space-y-1'>
                <p className='text-sm font-medium wrap-anywhere'>{token.name}</p>
                <p className='font-mono text-xs wrap-anywhere text-muted-foreground'>
                  {token.prefix}…
                </p>
                <div className='text-xs text-muted-foreground'>
                  <p>Created {format(new Date(token.createdAt), 'd MMM yyyy')}</p>
                  <p>
                    {token.lastUsedAt
                      ? `Last used ${format(new Date(token.lastUsedAt), 'd MMM yyyy, HH:mm')}`
                      : 'Never used'}
                  </p>
                </div>
              </div>
              <div className='shrink-0'>
                <RevokeTokenDialog token={token} />
              </div>
            </div>
          ))}
          <SettingsRow
            label='New token'
            value='Give each integration its own token.'
            action={<CreateTokenDialog />}
          />
        </SettingsList>
      </div>
    </SettingsGroup>
  );
}

import {format, formatDistanceToNowStrict} from 'date-fns';
import {KeyRound, Plus} from 'lucide-react';
import {useRef, useState} from 'react';

import {EmptyState} from '@/components/shared/layout/app-empty-state';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';

import {usePersonalAccessTokens} from '../../api/use-personal-access-tokens';
import {PersonalAccessToken} from '../../types/personal-access-token';
import {SettingsGroup, SettingsList} from '../settings-group';
import {CreateTokenDialog} from './create-token-dialog';
import {RevokeTokenDialog} from './revoke-token-dialog';

export function AccessTokenSettings() {
  const {data: tokens, isPending, isError, refetch} = usePersonalAccessTokens();
  // The dialog lives outside the empty state, so the one-time reveal survives the list refresh.
  const [creating, setCreating] = useState(false);
  const headerCreate = useRef<HTMLButtonElement>(null);
  const emptyCreate = useRef<HTMLButtonElement>(null);
  const hasTokens = (tokens?.length ?? 0) > 0;

  return (
    <SettingsGroup
      id='access-tokens-heading'
      title='Access tokens'
      description='Let an AI assistant read your Tempo data through MCP. Tokens are read-only and never expire, so revoke any you no longer use.'
      action={
        hasTokens && (
          <Button
            ref={headerCreate}
            variant='outline'
            size='sm'
            onClick={() => setCreating(true)}
            className='max-sm:h-11'
          >
            <Plus className='size-4' aria-hidden='true' />
            Create token
          </Button>
        )
      }
    >
      {isPending && <Skeleton className='h-24 w-full rounded-card border bg-card' />}
      {isError && (
        <EmptyState
          icon={KeyRound}
          tone='error'
          title='Access tokens could not be loaded.'
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
          title='No access tokens yet.'
          description='Create a token to connect an MCP client such as Hermes or Claude.'
        >
          <Button ref={emptyCreate} onClick={() => setCreating(true)} className='max-sm:h-11'>
            Create token
          </Button>
        </EmptyState>
      )}
      {hasTokens && (
        <SettingsList>
          {tokens?.map((token) => (
            <AccessTokenRow key={token.id} token={token} />
          ))}
        </SettingsList>
      )}
      <CreateTokenDialog
        open={creating}
        onOpenChange={setCreating}
        onClosed={() => (headerCreate.current ?? emptyCreate.current)?.focus()}
      />
    </SettingsGroup>
  );
}

function AccessTokenRow({token}: {token: PersonalAccessToken}) {
  return (
    <div
      data-testid='access-token-row'
      className='flex min-h-16 items-center justify-between gap-4 px-4 py-3'
    >
      <div className='min-w-0'>
        <p className='text-sm font-medium wrap-anywhere'>{token.name}</p>
        <p className='mt-0.5 font-mono text-xs wrap-anywhere text-muted-foreground'>
          {token.prefix}…
        </p>
        {/* Short dates keep "Created · Last used" on one line even beside the Revoke button. */}
        <p data-testid='access-token-usage' className='mt-0.5 text-xs text-muted-foreground'>
          Created {format(new Date(token.createdAt), 'd MMM yyyy')}
          <span aria-hidden='true' className='mx-1.5'>
            ·
          </span>
          {token.lastUsedAt ? (
            <span title={format(new Date(token.lastUsedAt), 'd MMM yyyy, HH:mm')}>
              Used {formatDistanceToNowStrict(new Date(token.lastUsedAt), {addSuffix: true})}
            </span>
          ) : (
            'Never used'
          )}
        </p>
      </div>
      <div className='shrink-0'>
        <RevokeTokenDialog token={token} />
      </div>
    </div>
  );
}

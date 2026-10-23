import {zodResolver} from '@hookform/resolvers/zod';
import {Check, ChevronRight, Copy, Loader} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {useForm} from 'react-hook-form';

import {Button} from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {useCreatePersonalAccessToken} from '../../api/use-personal-access-tokens';
import {
  CreatePersonalAccessTokenDto,
  TOKEN_LIFETIMES,
  createPersonalAccessTokenDtoSchema,
} from '../../types/create-personal-access-token.dto';

// The client runs where the user configures it; only the API base URL comes from this app.
function apiBaseUrl() {
  return new URL(import.meta.env.VITE_API_URL, window.location.origin).href.replace(/\/+$/, '');
}

function mcpClientConfig() {
  return JSON.stringify(
    {
      mcpServers: {
        tempo: {
          command: 'node',
          args: ['/path/to/tempo-api/mcp/dist/stdio.js'],
          env: {TEMPO_API_URL: apiBaseUrl(), TEMPO_API_TOKEN: '<your access token>'},
        },
      },
    },
    null,
    2,
  );
}

type CreateTokenDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after the dialog closes, to place focus on a control that still exists. */
  onClosed?: () => void;
};

export function CreateTokenDialog({open, onOpenChange, onClosed}: CreateTokenDialogProps) {
  const [secret, setSecret] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const create = useCreatePersonalAccessToken(setSecret);
  const form = useForm<CreatePersonalAccessTokenDto>({
    resolver: zodResolver(createPersonalAccessTokenDtoSchema),
    defaultValues: {name: '', expiresInDays: 90},
  });

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const resetDialog = () => {
    setSecret(undefined);
    setCopied(false);
    setCopyError(false);
    setConfigCopied(false);
    create.reset();
    form.reset({name: '', expiresInDays: 90});
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (create.isPending) return;
    if (nextOpen) resetDialog();
    onOpenChange(nextOpen);
    if (nextOpen) return;
    // Clear after the close animation, so a closing reveal does not flash the create form,
    // and drop the secret from memory unless the dialog was reopened in the meantime.
    setTimeout(() => {
      if (!openRef.current) resetDialog();
      onClosed?.();
    }, 250);
  };

  const submit = async (dto: CreatePersonalAccessTokenDto) => {
    try {
      await create.mutateAsync(dto);
    } catch {
      // Keep the entered name available for retry; the error is shown inside the dialog.
    }
  };

  const [configCopied, setConfigCopied] = useState(false);
  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(mcpClientConfig());
      setConfigCopied(true);
    } catch {
      setConfigCopied(false);
    }
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className='md:max-h-[calc(100svh-2rem)] md:max-w-132 md:overflow-y-auto'>
        <ResponsiveDialogHeader className='text-start'>
          <ResponsiveDialogTitle>
            {secret ? 'Copy your access token' : 'Create access token'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {secret
              ? "Make sure to copy your access token now. You won't be able to see it again."
              : 'Create a read-only token for an MCP client.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {secret ? (
          <>
            <ResponsiveDialogBody className='space-y-5'>
              <div className='space-y-2'>
                <Label htmlFor='created-access-token'>Access token</Label>
                {/* Copy sits inside the field's border; focusing the field selects the whole token. */}
                <div className='flex h-11 border bg-background max-sm:h-12'>
                  <input
                    id='created-access-token'
                    readOnly
                    value={secret}
                    spellCheck={false}
                    autoComplete='off'
                    onFocus={(event) => event.currentTarget.select()}
                    className='min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-ellipsis text-foreground outline-none selection:bg-primary selection:text-primary-foreground'
                  />
                  <Button
                    variant='ghost'
                    onClick={() => void copy()}
                    className='h-full shrink-0 border-l px-3'
                  >
                    {copied ? (
                      <Check className='size-4 text-success' aria-hidden='true' />
                    ) : (
                      <Copy className='size-4' aria-hidden='true' />
                    )}
                    {copied ? 'Copied' : 'Copy token'}
                  </Button>
                </div>
                {copyError && (
                  <p role='alert' className='text-sm text-destructive'>
                    Could not copy. Select the token and copy it manually.
                  </p>
                )}
              </div>
              <details className='group border-t pt-4'>
                <summary className='-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-2 px-2 text-sm font-medium hover:bg-accent/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden'>
                  <ChevronRight
                    className='size-4 text-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none'
                    aria-hidden='true'
                  />
                  Connect an MCP client
                </summary>
                <div className='mt-2 space-y-3 text-sm text-muted-foreground'>
                  <p>
                    Add this server to your MCP client&apos;s configuration. Replace the path with
                    where the Tempo MCP server is installed, and keep the token out of shared files.
                  </p>
                  <div className='flex items-start gap-2 border bg-muted/40 p-3'>
                    {/* Lines wrap instead of scrolling, so the dialog never shows a scrollbar. */}
                    <pre
                      data-testid='mcp-client-config'
                      className='min-w-0 flex-1 font-mono text-xs leading-5 wrap-anywhere whitespace-pre-wrap text-foreground'
                    >
                      {mcpClientConfig()}
                    </pre>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => void copyConfig()}
                      className='shrink-0 max-sm:h-11'
                    >
                      {configCopied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              </details>
            </ResponsiveDialogBody>
            <ResponsiveDialogFooter>
              <ResponsiveDialogClose asChild>
                <Button className='max-sm:h-11'>Done</Button>
              </ResponsiveDialogClose>
            </ResponsiveDialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className='grid gap-4' noValidate>
              <ResponsiveDialogBody className='space-y-3'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete='off' disabled={create.isPending} />
                      </FormControl>
                      <FormDescription>
                        A name to recognise this token by, such as the device or app using it.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='expiresInDays'
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Expiration</FormLabel>
                      <Select
                        disabled={create.isPending}
                        value={String(field.value ?? 'never')}
                        onValueChange={(value) =>
                          field.onChange(
                            TOKEN_LIFETIMES.find((lifetime) => lifetime.value === value)?.days ??
                              null,
                          )
                        }
                      >
                        <FormControl>
                          <SelectTrigger className='max-sm:h-11'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TOKEN_LIFETIMES.map((lifetime) => (
                            <SelectItem key={lifetime.value} value={lifetime.value}>
                              {lifetime.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {create.isPending && (
                  <p role='status' className='text-sm text-muted-foreground'>
                    Keep this dialog open while your token is being created.
                  </p>
                )}
                {create.isError && (
                  <p role='alert' className='text-sm text-destructive'>
                    Your token could not be created. Please try again.
                  </p>
                )}
              </ResponsiveDialogBody>
              <ResponsiveDialogFooter className='gap-2'>
                <Button
                  type='submit'
                  disabled={create.isPending}
                  className='max-sm:h-11 md:order-2'
                >
                  {create.isPending ? (
                    <>
                      <Loader className='size-4 animate-slow-spin' />
                      Creating…
                    </>
                  ) : (
                    'Create token'
                  )}
                </Button>
                <ResponsiveDialogClose asChild>
                  <Button
                    type='button'
                    variant='outline'
                    disabled={create.isPending}
                    className='max-sm:h-11 md:order-1'
                  >
                    Cancel
                  </Button>
                </ResponsiveDialogClose>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

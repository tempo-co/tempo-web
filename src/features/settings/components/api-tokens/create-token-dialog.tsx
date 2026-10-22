import {zodResolver} from '@hookform/resolvers/zod';
import {Check, Copy, Loader} from 'lucide-react';
import {useState} from 'react';
import {useForm} from 'react-hook-form';

import {Button} from '@/components/ui/button';
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form';
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
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';

import {useCreatePersonalAccessToken} from '../../api/use-personal-access-tokens';
import {
  CreatePersonalAccessTokenDto,
  createPersonalAccessTokenDtoSchema,
} from '../../types/create-personal-access-token.dto';

export function CreateTokenDialog() {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const create = useCreatePersonalAccessToken(setSecret);
  const form = useForm<CreatePersonalAccessTokenDto>({
    resolver: zodResolver(createPersonalAccessTokenDtoSchema),
    defaultValues: {name: ''},
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (create.isPending) return;
    setSecret(undefined);
    setCopied(false);
    setCopyError(false);
    create.reset();
    form.reset({name: ''});
    setOpen(nextOpen);
  };

  const submit = async (dto: CreatePersonalAccessTokenDto) => {
    try {
      await create.mutateAsync(dto);
    } catch {
      // Keep the entered name available for retry; the error is shown inside the dialog.
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
      <ResponsiveDialogTrigger asChild>
        <Button variant='outline' size='sm' className='min-w-20 max-sm:h-11'>
          Create token
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className='md:max-w-132'>
        <ResponsiveDialogHeader className='text-start'>
          <ResponsiveDialogTitle>
            {secret ? 'Save your API token' : 'Create API token'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {secret
              ? 'This token is only shown once. Copy it now and keep it somewhere safe.'
              : 'Read-only access to your Tempo data. Tokens do not expire; revoke them when no longer needed.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {secret ? (
          <>
            <ResponsiveDialogBody className='space-y-3'>
              <div className='space-y-2'>
                <Label htmlFor='created-api-token'>API token</Label>
                <textarea
                  id='created-api-token'
                  readOnly
                  value={secret}
                  rows={3}
                  className='w-full resize-none border bg-background px-3 py-2 font-mono text-sm break-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                />
              </div>
              <Button variant='outline' onClick={() => void copy()} className='max-sm:h-11'>
                {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
                {copied ? 'Copied' : 'Copy token'}
              </Button>
              {copyError && (
                <p role='alert' className='text-sm text-destructive'>
                  Could not copy. Select the token and copy it manually.
                </p>
              )}
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
                        <Input
                          {...field}
                          autoComplete='off'
                          placeholder='Example integration'
                          disabled={create.isPending}
                        />
                      </FormControl>
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

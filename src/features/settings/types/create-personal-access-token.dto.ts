import {z} from 'zod';

export const createPersonalAccessTokenDtoSchema = z.object({
  name: z.string().trim().min(1, 'Enter a token name.').max(100, 'Use 100 characters or fewer.'),
});

export type CreatePersonalAccessTokenDto = z.infer<typeof createPersonalAccessTokenDtoSchema>;

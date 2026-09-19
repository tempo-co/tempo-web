import {z} from 'zod';

export const BankTransferLinkSchema = z.object({
  legATransactionId: z.string().uuid(),
  legBTransactionId: z.string().uuid(),
  evidence: z.object({
    currency: z.string().length(3),
    amountDelta: z.string(),
    dateDeltaDays: z.number(),
    matchedOn: z.enum(['INTRA_CONNECTION_ACCOUNT', 'COUNTERPARTY_ACCOUNT']),
  }),
  ruleVersion: z.string(),
});

export type BankTransferLink = z.infer<typeof BankTransferLinkSchema>;

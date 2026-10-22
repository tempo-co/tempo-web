export const recurringQueryKeys = {
  root: ['recurring-series'] as const,
  lists: (asOf: string) => ['recurring-series', 'lists', asOf] as const,
  summary: (asOf: string) => ['recurring-series', 'summary', asOf] as const,
};

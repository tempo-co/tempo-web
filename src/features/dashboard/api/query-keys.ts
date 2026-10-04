export const dashboardQueryKeys = {
  summary: (month: string, asOf: string) => ['bank-transactions', 'summary', month, asOf] as const,
  reviewCounts: ['bank-transactions', 'review-counts'] as const,
};

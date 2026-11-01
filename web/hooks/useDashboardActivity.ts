'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useTaskSignature } from '@/hooks/useTaskSignature';

export type ActivityCategory = 'task' | 'campaign' | 'tip' | 'spin';

export interface DashboardActivityEvent {
  id: string;
  category: ActivityCategory;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  amount?: string;
  transactionHash?: string | null;
}

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not load your activity.');
  return result as DashboardActivityEvent[];
}

export function useDashboardActivity() {
  const { address } = useAccount();
  const signRequest = useTaskSignature();
  const query = useQuery({
    queryKey: ['dashboard-activity', address],
    enabled: false,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!address) throw new Error('Connect your wallet to view private activity.');
      const auth = await signRequest('POST', '/api/dashboard/activity', {});
      return parseResponse(await fetch('/api/dashboard/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth }),
      }));
    },
  });

  const loadActivity = async (refresh = false) => {
    if (query.data && !refresh) return query.data;
    const result = await query.refetch();
    return result.data;
  };

  return { ...query, loadActivity };
}


import { useState } from 'react';
import { useTradingStatsData } from './useTradingStatsData';

interface TimeRange {
  from: Date;
  to: Date;
}

export const useTradingStats = (userId?: string) => {
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return { from: sevenDaysAgo, to: now };
  });

  const { stats, isLoading, refetch } = useTradingStatsData(userId, timeRange);

  return {
    stats,
    isLoading,
    timeRange,
    setTimeRange,
    refetch
  };
};

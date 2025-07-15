
import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface TimeRange {
  from: Date;
  to: Date;
}

interface TradesReportFiltersProps {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  quickSelect: string;
  setQuickSelect: (period: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

const TradesReportFilters = ({
  timeRange,
  setTimeRange,
  quickSelect,
  setQuickSelect,
  statusFilter,
  setStatusFilter
}: TradesReportFiltersProps) => {
  const handleQuickSelect = (period: string) => {
    setQuickSelect(period);
    const now = new Date();
    let from: Date;

    switch (period) {
      case '1d':
        from = subDays(now, 1);
        break;
      case '7d':
        from = subDays(now, 7);
        break;
      case '30d':
        from = subDays(now, 30);
        break;
      case '90d':
        from = subDays(now, 90);
        break;
      case '1y':
        from = subDays(now, 365);
        break;
      default:
        from = subDays(now, 7);
    }

    console.log('🗓️ Quick select period:', period, 'Setting time range:', { from, to: now });
    setTimeRange({ from, to: now });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Quick Time Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Quick Select</label>
        <Select value={quickSelect} onValueChange={handleQuickSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* From Date */}
      <div className="space-y-2">
        <label className="text-sm font-medium">From Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !timeRange.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {timeRange.from ? format(timeRange.from, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={timeRange.from}
              onSelect={(date) => {
                if (date) {
                  console.log('🗓️ Manual from date selection:', date);
                  setTimeRange({ ...timeRange, from: date });
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* To Date */}
      <div className="space-y-2">
        <label className="text-sm font-medium">To Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !timeRange.to && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {timeRange.to ? format(timeRange.to, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={timeRange.to}
              onSelect={(date) => {
                if (date) {
                  console.log('🗓️ Manual to date selection:', date);
                  setTimeRange({ ...timeRange, to: date });
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Status Filter</label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
            <SelectItem value="partial_filled">Partial Filled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default TradesReportFilters;
